-- Run only in a disposable/local Supabase database with pgTAP installed.
begin;
select plan(1);
set local plpgsql.check_asserts = on;

do $$
declare
  v_first_key uuid := gen_random_uuid(); v_key uuid; v_file uuid := gen_random_uuid();
  v_first uuid; v_second uuid; v_lease uuid; v_new_lease uuid; v_result jsonb; v_claim jsonb;
  v_report jsonb := '{"summary":"Synthetic day one summary","topics":["Presentation topic"],"insights":["Feedback insight"],"conclusions":["Conclusion"],"questions":["Question"],"recap":"Synthetic recap","limitations":[]}'::jsonb;
begin
  assert (select count(*) from public.kase_events) = 2, 'test/live events must exist';
  assert (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.kase_events'::regclass, 'public.kase_feedback'::regclass, 'public.kase_presentations'::regclass,
    'public.kase_analyses'::regclass, 'public.kase_commands'::regclass, 'public.kase_rate_limits'::regclass)), 'all tables require RLS';
  assert not has_table_privilege('anon', 'public.kase_feedback', 'select'), 'anonymous raw reads denied';
  assert not has_table_privilege('authenticated', 'public.kase_analyses', 'select'), 'signed-in raw reads denied';
  assert not has_function_privilege('anon', 'public.kase_submit_feedback(text,uuid,text,text)', 'execute'), 'public RPC execution denied';
  assert not has_function_privilege('authenticated', 'public.kase_claim_step(text,uuid)', 'execute'), 'authenticated worker execution denied';
  assert (select not public from storage.buckets where id = 'kase-presentations'), 'presentation bucket private';
  assert exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'kase_presentations_private' and permissive = 'RESTRICTIVE'), 'bucket has restrictive policy';

  begin
    perform public.kase_submit_feedback('test', v_first_key, 'Synthetic feedback 1', repeat('a',64));
    raise exception 'TEST: accepted feedback before opening';
  exception when raise_exception then if sqlerrm <> 'kase_closed' then raise; end if; end;

  perform public.kase_command('test', gen_random_uuid(), 'open');
  for n in 1..70 loop
    v_key := case when n = 1 then v_first_key else gen_random_uuid() end;
    perform public.kase_submit_feedback('test', v_key, 'Synthetic feedback ' || n, repeat('a',64));
  end loop;
  assert (select count(*) from public.kase_feedback where environment = 'test') = 70, '70 same-network submissions accepted';
  perform public.kase_submit_feedback('test', v_first_key, 'Synthetic feedback 1', repeat('a',64));
  assert (select count(*) from public.kase_feedback where environment = 'test') = 70, 'submission replay deduplicated';
  begin
    perform public.kase_submit_feedback('test', v_first_key, 'Different payload', repeat('a',64));
    raise exception 'TEST: accepted conflicting retry';
  exception when raise_exception then if sqlerrm <> 'kase_conflict' then raise; end if; end;

  perform public.kase_command('test', gen_random_uuid(), 'presentation', jsonb_build_object(
    'id', v_file, 'filename', 'synthetic.pptx', 'kind', 'pptx', 'storagePath', 'test/' || v_file || '.pptx',
    'contentHash', repeat('b',64), 'text', 'Synthetic presentation topic'));
  assert (select count(*) from public.kase_analyses) = 0, 'collection/upload never creates AI task';
  begin
    perform public.kase_command('test', gen_random_uuid(), 'analyze');
    raise exception 'TEST: analyzed open collection';
  exception when raise_exception then if sqlerrm <> 'kase_collection_open' then raise; end if; end;
  perform public.kase_command('test', gen_random_uuid(), 'close');
  v_result := public.kase_submit_feedback('test', v_first_key, 'Synthetic feedback 1', repeat('a',64));
  assert (v_result->>'replayed')::boolean, 'confirmed submission retries still succeed after closing';
  begin
    perform public.kase_submit_feedback('test', gen_random_uuid(), 'Late feedback', repeat('a',64));
    raise exception 'TEST: accepted late feedback';
  exception when raise_exception then if sqlerrm <> 'kase_closed' then raise; end if; end;

  v_result := public.kase_command('test', gen_random_uuid(), 'analyze');
  v_first := (v_result->>'analysisId')::uuid;
  assert (select jsonb_array_length(snapshot->'feedback') from public.kase_analyses where id = v_first) = 70, 'snapshot includes every feedback';
  assert (public.kase_command('test', gen_random_uuid(), 'analyze')->>'analysisId')::uuid = v_first, 'analysis is deduplicated';
  assert public.kase_claim_step('live', v_first) is null, 'test job cannot be claimed in live';
  v_claim := public.kase_claim_step('test', v_first); v_lease := (v_claim->>'leaseToken')::uuid;
  assert public.kase_claim_step('test', v_first) is null, 'second worker cannot claim active lease';
  assert not public.kase_finish_step('test', v_first, gen_random_uuid(), '{}'), 'wrong lease cannot finish';
  update public.kase_analyses set leased_until = clock_timestamp() - interval '1 second' where id = v_first;
  v_claim := public.kase_claim_step('test', v_first); v_new_lease := (v_claim->>'leaseToken')::uuid;
  assert v_new_lease <> v_lease, 'expired lease replaced';
  assert not public.kase_finish_step('test', v_first, v_lease, '{}', v_report), 'stale worker fenced';
  assert public.kase_finish_step('test', v_first, v_new_lease, '{"presentation":"Summary","offset":0,"batches":[]}'), 'checkpoint persisted';
  v_claim := public.kase_claim_step('test', v_first);
  assert v_claim->'checkpoint'->>'presentation' = 'Summary', 'next worker receives checkpoint';
  assert public.kase_finish_step('test', v_first, (v_claim->>'leaseToken')::uuid,
    '{"presentation":"Summary","offset":70,"batches":["Feedback summary"]}', v_report), 'completed report persisted';
  assert (select published_analysis_id is null from public.kase_events where environment = 'test'), 'report not automatically published';
  perform public.kase_command('test', gen_random_uuid(), 'publish', jsonb_build_object('analysisId', v_first));
  begin
    perform public.kase_command('live', gen_random_uuid(), 'publish', jsonb_build_object('analysisId', v_first));
    raise exception 'TEST: cross-environment publication succeeded';
  exception when raise_exception then if sqlerrm <> 'kase_report_not_ready' then raise; end if; end;

  perform public.kase_command('test', gen_random_uuid(), 'notes', '{"notes":"Changed synthetic context"}');
  v_second := (public.kase_command('test', gen_random_uuid(), 'analyze')->>'analysisId')::uuid;
  assert v_second <> v_first, 'changed materials create new snapshot';
  assert (select published_analysis_id = v_first from public.kase_events where environment = 'test'), 'replacement preserves published version';
  assert (select report = v_report and status = 'completed' from public.kase_analyses where id = v_first), 'previous completed draft preserved';
  assert (select snapshot->>'notes' = '' from public.kase_analyses where id = v_first), 'original snapshot stays immutable';
  v_claim := public.kase_claim_step('test', v_second);
  assert public.kase_finish_step('test', v_second, (v_claim->>'leaseToken')::uuid, '{}', null, 'provider_error'), 'failed stage recorded';
  perform public.kase_command('test', gen_random_uuid(), 'open');
  begin
    perform public.kase_command('test', gen_random_uuid(), 'retry');
    raise exception 'TEST: retried during open collection';
  exception when raise_exception then if sqlerrm <> 'kase_collection_open' then raise; end if; end;
  perform public.kase_command('test', gen_random_uuid(), 'close');
  perform public.kase_command('test', gen_random_uuid(), 'retry');
  assert (select status = 'pending' from public.kase_analyses where id = v_second), 'closed collection can retry failure';
  assert (select count(*) from public.kase_feedback where environment = 'live') = 0, 'environments isolated';
end $$;

select pass('KASE collection, privacy, snapshots, retry, publication and lease fencing');
select * from finish();
rollback;

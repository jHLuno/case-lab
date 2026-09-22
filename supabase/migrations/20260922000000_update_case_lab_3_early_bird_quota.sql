set search_path = public, extensions, pg_catalog;

with previous_settings as (
  select id, environment, early_bird_quota, configuration_version
  from public.case_lab_3_event_settings
  where environment = 'live'
    and early_bird_quota is distinct from 45
  for update
), updated_settings as (
  update public.case_lab_3_event_settings settings
  set early_bird_quota = 45,
      configuration_version = settings.configuration_version + 1,
      updated_at = clock_timestamp()
  from previous_settings previous
  where settings.id = previous.id
  returning settings.id, settings.environment, settings.configuration_version
)
insert into public.case_lab_3_audit_log (
  environment,
  action,
  target_table,
  target_id,
  before_summary,
  after_summary,
  actor_id,
  actor_label
)
select
  updated.environment,
  'event_settings_early_bird_quota_updated',
  'case_lab_3_event_settings',
  updated.id,
  jsonb_build_object(
    'earlyBirdQuota', previous.early_bird_quota,
    'configurationVersion', previous.configuration_version
  ),
  jsonb_build_object(
    'earlyBirdQuota', 45,
    'configurationVersion', updated.configuration_version
  ),
  'migration',
  '20260922000000_update_case_lab_3_early_bird_quota'
from updated_settings updated
join previous_settings previous on previous.id = updated.id;

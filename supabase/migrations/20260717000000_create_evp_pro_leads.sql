CREATE TABLE IF NOT EXISTS evp_pro_leads (
  id bigint generated always as identity primary key,
  name text not null,
  phone text not null,
  position text,
  status text not null default 'new'
    check (status in ('new','contacted','scheduled','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

ALTER TABLE evp_pro_leads enable row level security;

-- Public: only allow inserting new leads (no read/update/delete)
CREATE POLICY "Allow anon insert" ON evp_pro_leads FOR INSERT TO anon
  WITH CHECK (true);

-- Service role (used by CRM API) bypasses RLS automatically

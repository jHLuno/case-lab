-- Proposal (КП) requests from the corporate intensive landing (/hr-intensive/).
-- Same base shape as leads/evp_pro_leads so the CRM can list it as another
-- source; structured request fields are kept separately for analysis.
CREATE TABLE IF NOT EXISTS hr_intensive_leads (
  id bigint generated always as identity primary key,
  name text not null,
  phone text not null,
  position text,
  company text not null,
  format text check (format is null or format in ('3h','5h','8h')),
  blocks text[] not null default '{}',
  audience text[] not null default '{}',
  status text not null default 'new'
    check (status in ('new','contacted','scheduled','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  CONSTRAINT hr_intensive_leads_name_length CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  CONSTRAINT hr_intensive_leads_phone_format CHECK (phone ~ '^\+?[78]7[0-9]{9}$'),
  CONSTRAINT hr_intensive_leads_position_length CHECK (position IS NULL OR char_length(position) <= 200),
  CONSTRAINT hr_intensive_leads_company_length CHECK (char_length(trim(company)) BETWEEN 1 AND 200),
  CONSTRAINT hr_intensive_leads_blocks_allowed CHECK (blocks <@ ARRAY['zoomer','ejm','evp']::text[]),
  CONSTRAINT hr_intensive_leads_audience_size CHECK (cardinality(audience) <= 4),
  CONSTRAINT hr_intensive_leads_notes_length CHECK (notes IS NULL OR char_length(notes) <= 2000)
);

ALTER TABLE hr_intensive_leads enable row level security;

-- Public: only allow inserting new leads (no read/update/delete)
CREATE POLICY "Allow anon insert" ON hr_intensive_leads FOR INSERT TO anon
  WITH CHECK (true);

-- Service role (used by CRM API) bypasses RLS automatically

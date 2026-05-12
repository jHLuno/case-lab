CREATE TABLE IF NOT EXISTS leads (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  company text,
  phone text,
  position text,
  message text,
  status text not null default 'new'
    check (status in ('new','contacted','scheduled','completed','cancelled')),
  created_at timestamptz not null default now()
);

ALTER TABLE leads enable row level security;

CREATE POLICY "Allow anon insert" ON leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select" ON leads FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update" ON leads FOR UPDATE TO anon USING (true);

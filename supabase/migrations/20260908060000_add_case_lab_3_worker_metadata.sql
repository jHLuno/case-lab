alter table public.case_lab_3_fiscal_operations
  add column if not exists queued_at timestamptz,
  add column if not exists uncertain_since_at timestamptz;

-- Defense-in-depth: the anon INSERT policy (WITH CHECK (true)) lets anyone
-- with the public anon key insert directly via the Supabase REST API,
-- bypassing the Next.js API route's validation and rate limiting entirely.
-- These constraints enforce the same shape the client already validates,
-- so malformed/junk rows can't land regardless of insert path.
--
-- NOT VALID: enforced for all new inserts/updates immediately, without
-- scanning (and potentially failing on) any existing rows.

ALTER TABLE leads
  ADD CONSTRAINT leads_name_length CHECK (char_length(trim(name)) BETWEEN 1 AND 200) NOT VALID,
  ADD CONSTRAINT leads_phone_format CHECK (phone ~ '^\+?[78]7[0-9]{9}$') NOT VALID,
  ADD CONSTRAINT leads_position_length CHECK (position IS NULL OR char_length(position) <= 200) NOT VALID;

ALTER TABLE evp_pro_leads
  ADD CONSTRAINT evp_pro_leads_name_length CHECK (char_length(trim(name)) BETWEEN 1 AND 200) NOT VALID,
  ADD CONSTRAINT evp_pro_leads_phone_format CHECK (phone ~ '^\+?[78]7[0-9]{9}$') NOT VALID,
  ADD CONSTRAINT evp_pro_leads_position_length CHECK (position IS NULL OR char_length(position) <= 200) NOT VALID;

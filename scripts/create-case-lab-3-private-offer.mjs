import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const environment = process.argv[2];
if (environment !== "test" && environment !== "live") {
  throw new Error("Usage: node scripts/create-case-lab-3-private-offer.mjs <test|live>");
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required");
}

const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.rpc("case_lab_3_create_private_offer", {
  p_environment: environment,
  p_token_hash: tokenHash,
  p_amount_minor: 500000,
});

if (error || !data || data.kind !== "created") {
  throw new Error(error?.message ?? "Private offer was not created");
}

const origin = (process.env.CASE_LAB_3_PUBLIC_ORIGIN ?? "https://caselab.kz").replace(/\/$/u, "");
console.log(`${origin}/case-lab-3/private/${token}/`);

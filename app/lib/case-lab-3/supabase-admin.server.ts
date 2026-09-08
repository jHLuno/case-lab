import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

export type CaseLab3RateLimitRpcArgs = Database["public"]["Functions"]["case_lab_3_consume_rate_limit"]["Args"];
export type CaseLab3RateLimitRpcData = Database["public"]["Functions"]["case_lab_3_consume_rate_limit"]["Returns"];
export type CaseLab3AdminClient = SupabaseClient<Database>;

export function getCaseLab3AdminClient(): CaseLab3AdminClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error("Case Lab III database configuration incomplete");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

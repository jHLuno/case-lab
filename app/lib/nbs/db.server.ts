import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { NbsDatabase } from "./database.types";

export type NbsAdminClient = SupabaseClient<NbsDatabase>;

export function getNbsAdminClient(): NbsAdminClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) throw new Error("NBS database configuration incomplete");
  return createClient<NbsDatabase>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

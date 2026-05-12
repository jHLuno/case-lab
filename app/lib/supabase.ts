import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Lazy client — throws only on actual usage if not configured
let client: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!client) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    client = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder", {
      auth: { persistSession: false },
    });
  }
  return client;
}

export const supabase = getSupabase();

export type Lead = {
  id: number;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  position: string | null;
  message: string | null;
  status: "new" | "contacted" | "scheduled" | "completed" | "cancelled";
  created_at: string;
};

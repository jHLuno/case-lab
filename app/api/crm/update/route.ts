import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { noStoreJson } from "../../../lib/case-lab-3/http.server";
import { resolveCrmTable } from "../../../lib/crm-tables";
import { requireCrmAdmin, verifyCrmMutation } from "../../../lib/crm-auth.server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getServiceSupabase() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase service role not configured");
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("crm_auth")?.value;

    if (!token) {
      return noStoreJson({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await requireCrmAdmin(token);
    if (!session) {
      return noStoreJson({ error: "Session expired" }, { status: 401 });
    }

    if (!verifyCrmMutation(request, session)) {
      return noStoreJson({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, notes, source } = body;

    if (!id) {
      return noStoreJson({ error: "ID required" }, { status: 400 });
    }

    const table = resolveCrmTable(source);
    if (!table) {
      return noStoreJson({ error: "Invalid source" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    if (Object.keys(updateData).length === 0) {
      return noStoreJson({ error: "Nothing to update" }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from(table)
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error("Supabase update error:", error);
      return noStoreJson({ error: "Database error" }, { status: 500 });
    }

    return noStoreJson({ success: true });
  } catch (err) {
    console.error("CRM update error:", err);
    return noStoreJson({ error: "Server error" }, { status: 500 });
  }
}

import QRCode from "qrcode";

import { requireCrmAdmin } from "@/lib/crm-auth.server";
import { noStoreJson } from "@/lib/case-lab-3/http.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NBS_FORM_URL = "https://caselab.kz/narxoz-business-school/";

export async function GET(request: Request): Promise<Response> {
  if (!await requireCrmAdmin()) return noStoreJson({ error: "unauthorized" }, { status: 401 });
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "png" && format !== "svg") return noStoreJson({ error: "invalid_request" }, { status: 400 });
  try {
    const options = { errorCorrectionLevel: "M" as const, margin: 4, color: { dark: "#000000", light: "#ffffff" } };
    const body = format === "png"
      ? await QRCode.toBuffer(NBS_FORM_URL, { ...options, type: "png", width: 1024 })
      : await QRCode.toString(NBS_FORM_URL, { ...options, type: "svg" });
    const contentType = format === "png" ? "image/png" : "image/svg+xml; charset=utf-8";
    return new Response(typeof body === "string" ? body : new Uint8Array(body), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": 'attachment; filename="nbs-forum-2026-qr.' + format + '"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

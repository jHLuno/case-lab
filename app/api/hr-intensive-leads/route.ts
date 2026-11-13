import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "../../lib/rate-limit";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const FORMAT_LABELS: Record<string, string> = {
  "3h": "3 часа",
  "5h": "Полдня (5 часов)",
  "8h": "Целый день (8 часов)",
};

const BLOCK_LABELS: Record<string, string> = {
  zoomer: "Зумерология",
  ejm: "EJM",
  evp: "EVP",
};

const AUDIENCES = new Set(["Коммерция и продажи", "Маркетинг", "HR", "Руководство"]);

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function pickKnown(value: unknown, allowed: (item: string) => boolean): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && allowed(item)))];
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`hr-intensive-lead:${ip}`);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many submissions. Try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.replace(/[\s\-()]/g, "") : "";
    const company = typeof body.company === "string" ? body.company.trim().slice(0, 120) : "";
    const role = typeof body.position === "string" ? body.position.trim().slice(0, 70) : "";

    if (!name || !phone || !company) {
      return NextResponse.json(
        { error: "Name, phone and company are required" },
        { status: 400 }
      );
    }

    const formatId = typeof body.format === "string" && Object.hasOwn(FORMAT_LABELS, body.format) ? body.format : null;
    const blockIds = pickKnown(body.blocks, (item) => Object.hasOwn(BLOCK_LABELS, item));
    const format = formatId ? FORMAT_LABELS[formatId] : undefined;
    const blocks = blockIds.map((item) => BLOCK_LABELS[item]);
    const audience = pickKnown(body.audience, (item) => AUDIENCES.has(item));

    const notes = [
      `Запрос КП: корпоративный интенсив`,
      `Формат: ${format ?? "не выбран"}`,
      `Блоки: ${blocks.length ? blocks.join(", ") : "не выбраны"}`,
      audience.length ? `Аудитория: ${audience.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    });

    const { error } = await supabase.from("hr_intensive_leads").insert({
      name: name.slice(0, 200),
      phone,
      position: [role, company].filter(Boolean).join(" · "),
      company,
      format: formatId,
      blocks: blockIds,
      audience,
      notes,
      status: "new",
    });

    if (error) {
      console.error("Supabase insert error:", error.code);
      return NextResponse.json(
        { error: "Failed to save lead" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("HR intensive lead API error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

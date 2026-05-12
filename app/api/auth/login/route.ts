import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createToken } from "../../../lib/jwt";
import { checkRateLimit } from "../../../lib/rate-limit";

const CRM_PASSWORD = process.env.CRM_PASSWORD;

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  try {
    if (!CRM_PASSWORD) {
      return NextResponse.json(
        { error: "CRM not configured" },
        { status: 503 }
      );
    }

    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`login:${ip}`);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 }
      );
    }

    const { password } = await request.json();

    if (!password || password !== CRM_PASSWORD) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    const token = await createToken();
    const cookieStore = await cookies();
    cookieStore.set("crm_auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3600, // 1 hour
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}

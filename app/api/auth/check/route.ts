import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "../../../lib/jwt";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("crm_auth")?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const isValid = await verifyToken(token);

  if (!isValid) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true });
}

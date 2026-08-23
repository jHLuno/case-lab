import { NextRequest, NextResponse } from "next/server";

function getSupabaseOrigin() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return "";

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return "";
  }
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const isDev = process.env.NODE_ENV === "development";
  const supabaseOrigin = getSupabaseOrigin();
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers();
  const forwardableHeaders = ["accept", "accept-language", "cookie", "host", "user-agent"];

  for (const header of forwardableHeaders) {
    const value = request.headers.get(header);
    if (value) requestHeaders.set(header, value);
  }

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

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

function isCaseLab3Path(pathname: string): boolean {
  return pathname === "/case-lab-3" || pathname.startsWith("/case-lab-3/");
}

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const isDev = process.env.NODE_ENV === "development";
  const supabaseOrigin = getSupabaseOrigin();
  const caseLab3WidgetOrigin = isCaseLab3Path(request.nextUrl.pathname)
    ? " https://widget.tiptoppay.kz"
    : "";
  const caseLab3FrameDirective = isCaseLab3Path(request.nextUrl.pathname)
    ? `frame-src 'self'${caseLab3WidgetOrigin}`
    : null;
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}${caseLab3WidgetOrigin}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    caseLab3FrameDirective,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    "upgrade-insecure-requests",
  ].filter((directive): directive is string => directive !== null).join("; ");

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
  response.headers.set("x-nonce", nonce);

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

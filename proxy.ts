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

function isGtmPath(pathname: string): boolean {
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return (
    normalizedPathname === "/" ||
    normalizedPathname === "/evp-pro" ||
    normalizedPathname === "/case-lab-3"
  );
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
  const isCaseLab3 = isCaseLab3Path(request.nextUrl.pathname);
  const isGtm = isGtmPath(request.nextUrl.pathname);
  const caseLab3WidgetOrigin = isCaseLab3
    ? " https://widget.tiptoppay.kz"
    : "";
  const gtmScriptOrigin = isGtm ? " https://www.googletagmanager.com" : "";
  const gtmConnectOrigins = isGtm
    ? " https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com"
    : "";
  const gtmImageOrigins = isGtm ? " https://www.google-analytics.com" : "";
  const frameDirective =
    isCaseLab3 || isGtm
      ? `frame-src 'self'${caseLab3WidgetOrigin}${isGtm ? " https://www.googletagmanager.com" : ""}`
      : null;
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}${caseLab3WidgetOrigin}${gtmScriptOrigin}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data:${gtmImageOrigins}`,
    "font-src 'self'",
    frameDirective,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}${gtmConnectOrigins}`,
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

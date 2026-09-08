import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type ProviderHmacMode = "raw" | "raw-body" | "content" | "content-hmac" | "x-content-hmac" | "decoded";

function decodeBase64Signature(value: string): Buffer | null {
  if (!/^[A-Za-z0-9+/]{42,43}={0,2}$/u.test(value)) {
    return null;
  }

  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) return null;

  const canonical = decoded.toString("base64");
  if (value !== canonical && value !== canonical.replace(/=+$/u, "")) {
    return null;
  }
  return decoded;
}

export function verifyProviderHmac(
  rawBody: Uint8Array | string,
  headers: Headers,
  secret: string,
  mode: ProviderHmacMode,
): boolean {
  if (typeof secret !== "string" || secret.length === 0) return false;

  // The decoded X-Content-HMAC representation is unsupported until a provider fixture proves it.
  if (mode === "x-content-hmac" || mode === "decoded") return false;
  if (mode !== "raw" && mode !== "raw-body" && mode !== "content" && mode !== "content-hmac") return false;

  const supplied = headers.get("content-hmac");
  if (!supplied) return false;
  const actual = decodeBase64Signature(supplied.trim());
  if (!actual) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

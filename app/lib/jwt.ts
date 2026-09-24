import "server-only";

import { SignJWT, jwtVerify } from "jose";

export const CRM_SESSION_TTL_SECONDS = 12 * 60 * 60;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createToken(): Promise<string> {
  return new SignJWT({ role: "crm_admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("caselab.kz")
    .setAudience("caselab-crm")
    .setIssuedAt()
    .setExpirationTime(`${CRM_SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: "caselab.kz",
      audience: "caselab-crm",
      clockTolerance: 60,
    });
    return payload.role === "crm_admin";
  } catch {
    return false;
  }
}

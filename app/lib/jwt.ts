import "server-only";

import { SignJWT, jwtVerify } from "jose";

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
    .setExpirationTime("1h")
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

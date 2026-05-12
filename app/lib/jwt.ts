import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.CRM_PASSWORD || "fallback-secret-do-not-use"
);

export async function createToken(): Promise<string> {
  return new SignJWT({ role: "crm_admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, SECRET, { clockTolerance: 60 });
    return true;
  } catch {
    return false;
  }
}

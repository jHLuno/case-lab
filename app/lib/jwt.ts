import { SignJWT, jwtVerify } from "jose";

function getSecret(): Uint8Array {
  const pwd = process.env.CRM_PASSWORD;
  if (!pwd || pwd.length < 16) {
    throw new Error("CRM_PASSWORD must be set and at least 16 characters");
  }
  return new TextEncoder().encode(pwd);
}

export async function createToken(): Promise<string> {
  return new SignJWT({ role: "crm_admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret(), { clockTolerance: 60 });
    return true;
  } catch {
    return false;
  }
}

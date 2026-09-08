import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { crmAuthModule } from "./server-only-test-loader";

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function nonCanonicalPadBits(token: string): string {
  const last = token[token.length - 1];
  const index = BASE64URL_ALPHABET.indexOf(last);
  assert.equal(index >= 0, true);
  assert.equal(index & 3, 0);
  return `${token.slice(0, -1)}${BASE64URL_ALPHABET[index | 1]}`;
}

test("CSRF tokens are bound to the CRM session and reject non-canonical pad bits", async () => {
  const { issueCrmCsrfToken, verifyCrmMutation } = await crmAuthModule;
  process.env.CASE_LAB_3_TOKEN_SECRET = "t".repeat(32);
  const session = { role: "crm_admin" as const, token: "session-token" };
  const csrfToken = issueCrmCsrfToken(session);
  const request = new Request("https://caselab.kz/api/admin/mutation", {
    method: "POST",
    headers: {
      Origin: "https://caselab.kz",
      "X-CSRF-Token": csrfToken,
    },
  });

  assert.equal(verifyCrmMutation(request, session), true);
  assert.equal(
    verifyCrmMutation(
      new Request(request.url, {
        method: "POST",
        headers: { Origin: "https://caselab.kz", "X-CSRF-Token": nonCanonicalPadBits(csrfToken) },
      }),
      session,
    ),
    false,
  );
  assert.equal(
    verifyCrmMutation(
      new Request(request.url, {
        method: "POST",
        headers: { Origin: "https://caselab.kz", "X-CSRF-Token": issueCrmCsrfToken("other-session") },
      }),
      session,
    ),
    false,
  );
});

test("CRM mutations reject wrong roles, cross-origin requests, and non-mutation methods", async () => {
  const { issueCrmCsrfToken, verifyCrmMutation } = await crmAuthModule;
  process.env.CASE_LAB_3_TOKEN_SECRET = "t".repeat(32);
  const viewer = { role: "viewer", token: "session-token" } as never;
  const csrfToken = issueCrmCsrfToken("session-token");

  assert.equal(
    verifyCrmMutation(
      new Request("https://caselab.kz/api/admin/mutation", {
        method: "POST",
        headers: { Origin: "https://caselab.kz", "X-CSRF-Token": csrfToken },
      }),
      viewer,
    ),
    false,
  );
  assert.equal(
    verifyCrmMutation(
      new Request("https://caselab.kz/api/admin/mutation", {
        method: "POST",
        headers: { Origin: "https://evil.example", "X-CSRF-Token": csrfToken },
      }),
      { role: "crm_admin", token: "session-token" },
    ),
    false,
  );

  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(
      verifyCrmMutation(
        new Request("https://caselab.kz/api/admin/mutation", {
          method,
          headers: { Origin: "https://caselab.kz", "X-CSRF-Token": csrfToken },
        }),
        { role: "crm_admin", token: "session-token" },
      ),
      false,
      `${method} must not be treated as a mutation`,
    );
  }

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(
      verifyCrmMutation(
        new Request("https://caselab.kz/api/admin/mutation", {
          method,
          headers: { Origin: "https://caselab.kz", "X-CSRF-Token": csrfToken },
        }),
        { role: "crm_admin", token: "session-token" },
      ),
      true,
      `${method} must be treated as a mutation`,
    );
  }
});

test("CRM mutation routes and UI wire the session-bound CSRF token", async () => {
  const [updateSource, deleteSource, pageSource] = await Promise.all([
    readFile("app/api/crm/update/route.ts", "utf8"),
    readFile("app/api/crm/delete/route.ts", "utf8"),
    readFile("app/crm/page.tsx", "utf8"),
  ]);

  for (const source of [updateSource, deleteSource]) {
    assert.match(source, /requireCrmAdmin/);
    assert.match(source, /verifyCrmMutation\(request, session\)/);
    assert.match(source, /noStoreJson/);
    assert.doesNotMatch(source, /verifyToken/);
    assert.ok(source.indexOf("if (!verifyCrmMutation") < source.indexOf("const body = await request.json"));
  }

  assert.match(pageSource, /csrfToken/);
  assert.match(pageSource, /auth\/check/);
  assert.match(pageSource, /setCsrfToken\([^)]*csrfToken/);
  assert.equal((pageSource.match(/"X-CSRF-Token": csrfToken/g) ?? []).length, 2);
});

test("CRM mutation auth failures clear authenticated and CSRF UI state", async () => {
  const pageSource = await readFile("app/crm/page.tsx", "utf8");

  for (const handler of ["saveLead", "deleteLead"]) {
    const start = pageSource.indexOf(`const ${handler} = async`);
    assert.notEqual(start, -1, `${handler} handler must exist`);
    const end = pageSource.indexOf("\n  const ", start + 1);
    const handlerSource = pageSource.slice(start, end === -1 ? pageSource.length : end);

    assert.match(handlerSource, /res\.status === 401/);
    assert.match(handlerSource, /res\.status === 403/);
    assert.match(handlerSource, /setIsAuthenticated\(false\)/);
    assert.match(handlerSource, /setCsrfToken\(null\)/);
  }
});

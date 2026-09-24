import assert from "node:assert/strict";
import test from "node:test";

import "../case-lab-3-payments/server-only-test-loader";

import { caseLab3LiveArchivedResponse, isCaseLab3LiveArchived } from "../../app/lib/case-lab-3/live/archive.server";

test("live archive policy is production-only and scoped to the live environment", () => {
  const nodeEnvironment = process.env as unknown as Record<string, string | undefined>;
  const originalNodeEnv = nodeEnvironment.NODE_ENV;
  try {
    nodeEnvironment.NODE_ENV = "production";
    assert.equal(isCaseLab3LiveArchived("live"), true);
    assert.equal(isCaseLab3LiveArchived("test"), false);

    nodeEnvironment.NODE_ENV = "development";
    assert.equal(isCaseLab3LiveArchived("live"), false);
  } finally {
    if (originalNodeEnv === undefined) delete nodeEnvironment.NODE_ENV;
    else nodeEnvironment.NODE_ENV = originalNodeEnv;
  }
});

test("archive response is no-store and reports that the event ended", async () => {
  const response = caseLab3LiveArchivedResponse();
  assert.equal(response.status, 410);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "event_ended" });
});

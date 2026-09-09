import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePath = "app/crm/case-lab-3/orders/[id]/OrderActionsClient.tsx";

test("CRM keeps ticket cancellation separate and disables automatic refunds", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /cancel-ticket/iu);
  assert.match(source, /Оплата не возвращается/iu);
  assert.match(source, /Автоматический возврат отключён/iu);
  assert.doesNotMatch(source, /Оформить полный возврат/iu);
  assert.doesNotMatch(source, /\/refunds/iu);
  assert.match(source, /ticketCancelled/u);
  assert.doesNotMatch(source, /case_lab_3_create_refund|initiate_refund/iu);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePath = "app/crm/case-lab-3/orders/[id]/OrderActionsClient.tsx";

test("CRM keeps ticket cancellation separate from the full refund action", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /cancel-ticket/iu);
  assert.match(source, /Оплата не возвращается/iu);
  assert.match(source, /Оформить полный возврат/iu);
  assert.match(source, /\/refunds/iu);
  assert.match(source, /Вернуть \$\{formatAmount\(refundableAmountMinor\)\} через TipTop Pay\?/u);
  assert.match(source, /После подтверждения действие нельзя повторить/u);
  assert.match(source, /refundReason\.trim\(\)/u);
  assert.match(source, /refundRequestKeyRef/u);
  assert.match(source, /response\.status !== 202/u);
  assert.match(source, /Возврат поставлен в очередь/u);
  assert.match(source, /router\.refresh\(\)/u);
  assert.match(source, /Оформить полный возврат \{formatAmount\(refundableAmountMinor\)\}/u);
  assert.match(source, /disabled=\{refundDisabled\}/u);
  assert.match(source, /refundableAmountMinor <= 0/u);
  assert.match(source, /refunds\.length > 0/u);
  assert.match(source, /ticketCancelled/u);
  assert.doesNotMatch(source, /case_lab_3_create_refund|initiate_refund/iu);
});

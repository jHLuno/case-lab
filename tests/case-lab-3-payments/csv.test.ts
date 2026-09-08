import assert from "node:assert/strict";
import test from "node:test";

import "./server-only-test-loader";

test("CSV cells neutralize spreadsheet formulas with one leading apostrophe", async () => {
  const { neutralizeSpreadsheetFormula } = await import("../../app/lib/case-lab-3/csv.server");

  for (const value of ["=SUM(A1:A2)", "+cmd", "-10+2", "@user"]) {
    assert.equal(neutralizeSpreadsheetFormula(value), `'${value}`);
  }
  assert.equal(neutralizeSpreadsheetFormula("safe"), "safe");
  assert.equal(neutralizeSpreadsheetFormula(null), "");
});

test("CSV output is UTF-8, quoted safely, and contains only selected columns", async () => {
  const { buildCsv } = await import("../../app/lib/case-lab-3/csv.server");

  const csv = buildCsv(
    [
      {
        orderNumber: "CL3-0001",
        participantEmail: "buyer@example.test",
        company: "=HYPERLINK(\"https://evil.test\")",
        ignoredSecret: "card-number",
      },
    ],
    [
      { key: "orderNumber", label: "Номер заказа" },
      { key: "participantEmail", label: "Email участника" },
      { key: "company", label: "Компания" },
    ],
  );

  assert.match(csv, /Номер заказа,Email участника,Компания/);
  assert.match(csv, /CL3-0001,buyer@example\.test,"'=HYPERLINK/);
  assert.doesNotMatch(csv, /card-number/);
});

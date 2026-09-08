function assertMinorUnit(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError("Amount must be a safe integer minor units value");
  }
  if (amountMinor < 0) {
    throw new RangeError("Amount must be non-negative minor units");
  }
}

export function minorToMajor(amountMinor: number): number {
  assertMinorUnit(amountMinor);
  return amountMinor / 100;
}

export function formatKzt(amountMinor: number): string {
  assertMinorUnit(amountMinor);
  const whole = Math.floor(amountMinor / 100);
  const cents = amountMinor % 100;
  const groupedWhole = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const decimal = cents === 0 ? "" : `.${String(cents).padStart(2, "0")}`;

  return `${groupedWhole}${decimal} ₸`;
}

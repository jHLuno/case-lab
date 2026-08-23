const configuredCheckoutHref = process.env.NEXT_PUBLIC_CASE_LAB_3_CHECKOUT_URL?.trim();
const configuredCheckoutHost = process.env.NEXT_PUBLIC_CASE_LAB_3_CHECKOUT_HOST?.trim().toLowerCase();

export function normalizeCaseLab3CheckoutHref(value: string | undefined, allowedHost?: string) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = allowedHost?.trim().toLowerCase();

    if (
      !host ||
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hostname !== host
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export const caseLab3CheckoutHref = normalizeCaseLab3CheckoutHref(
  configuredCheckoutHref,
  configuredCheckoutHost,
);

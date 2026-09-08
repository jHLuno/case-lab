"use client";

import type { CSSProperties, ReactNode } from "react";

import { useCaseLab3Checkout } from "./CaseLab3CheckoutProvider";
import type { CheckoutSource } from "./checkout-machine";

export default function CaseLab3CheckoutButton({
  source,
  children,
  className,
  style,
}: {
  source: CheckoutSource;
  children: ReactNode;
  className: string;
  style?: CSSProperties;
}) {
  const { openCheckout } = useCaseLab3Checkout();

  return (
    <button type="button" className={className} style={style} onClick={() => openCheckout(source)}>
      {children}
    </button>
  );
}

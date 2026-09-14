"use client";

import type { CSSProperties, ReactNode } from "react";

import { pushCaseLab3Event } from "../analytics";
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
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => {
        pushCaseLab3Event({ name: "case_lab_3_cta_clicked", source });
        openCheckout(source);
      }}
    >
      {children}
    </button>
  );
}

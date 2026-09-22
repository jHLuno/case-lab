import type { Metadata } from "next";
import { headers } from "next/headers";

import CaseLab3Page from "../../../components/CaseLab3Page";
import { getPrivateOfferAvailability, getPublicPaymentEnvironment } from "@/lib/case-lab-3/orders.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Case Lab III | Персональный билет",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PrivateCaseLab3Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  let privateOfferAmountMinor: number | undefined;
  try {
    const availability = await getPrivateOfferAvailability(getPublicPaymentEnvironment(), token);
    privateOfferAmountMinor = availability.amountMinor ?? undefined;
  } catch {
    privateOfferAmountMinor = undefined;
  }

  return <CaseLab3Page nonce={nonce} privateOfferToken={token} privateOfferAmountMinor={privateOfferAmountMinor} />;
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import EVPProPage from "../components/EVPProPage";
import GoogleTagManager from "../components/GoogleTagManager";

export const metadata: Metadata = {
  title: "EVP PRO - Практическая сессия по EVP | Case Lab",
  description:
    "EVP PRO - практическая сессия для руководителей, HR, PR и маркетинг-команд о ценностном предложении работодателя.",
  alternates: {
    canonical: "/evp-pro/",
  },
};

export default async function Page() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <GoogleTagManager nonce={nonce} />
      <EVPProPage />
    </>
  );
}

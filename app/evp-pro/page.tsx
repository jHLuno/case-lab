import type { Metadata } from "next";
import EVPProPage from "../components/EVPProPage";

export const metadata: Metadata = {
  title: "EVP Pro - Практическая сессия по EVP | Case Lab",
  description:
    "EVP Pro - практическая сессия для руководителей, HR, PR и маркетинг-команд о ценностном предложении работодателя.",
  alternates: {
    canonical: "/evp-pro/",
  },
};

export default function Page() {
  return <EVPProPage />;
}

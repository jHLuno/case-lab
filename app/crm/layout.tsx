import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRM — Case Lab",
  robots: "noindex, nofollow",
};

export default function CRMLayout({ children }: { children: React.ReactNode }) {
  return children;
}

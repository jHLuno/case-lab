import Link from "next/link";

import { issueCrmCsrfToken, requireCrmAdmin } from "@/lib/crm-auth.server";
import CrmSectionNav from "../components/CrmSectionNav";
import NbsOperatorClient from "./NbsOperatorClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function NbsCrmPage() {
  const session = await requireCrmAdmin();
  if (!session) {
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-xl">
          <p className="text-sm text-black/60" style={{ fontFamily: "var(--font-body)" }}>Требуется вход в CRM.</p>
          <Link href="/crm/" className="mt-4 inline-flex text-sm text-[#991E1E] hover:underline" style={{ fontFamily: "var(--font-body)" }}>
            Вернуться ко входу
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f3f2] px-4 py-5 sm:px-6 md:px-10 md:py-8">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-7"><CrmSectionNav active="nbs" /></div>
        <NbsOperatorClient csrfToken={issueCrmCsrfToken(session)} />
      </div>
    </main>
  );
}

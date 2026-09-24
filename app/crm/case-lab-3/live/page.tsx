import Link from "next/link";

import { issueCrmCsrfToken, requireCrmAdmin } from "@/lib/crm-auth.server";
import { isCaseLab3LiveArchived } from "@/lib/case-lab-3/live/archive.server";
import CrmSectionNav from "../../components/CrmSectionNav";
import LiveOperatorClient from "./LiveOperatorClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CaseLab3LiveCrmPage() {
  const session = await requireCrmAdmin();
  if (!session) {
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-xl">
          <p className="text-sm text-black/50" style={{ fontFamily: "var(--font-body)" }}>Требуется вход в CRM.</p>
          <Link href="/crm/" className="mt-4 inline-flex text-sm text-[#040082] hover:underline" style={{ fontFamily: "var(--font-body)" }}>
            Вернуться ко входу
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa] px-5 py-7 md:px-10 md:py-10">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-7">
          <CrmSectionNav active="case-lab-3-live" />
        </div>
        <LiveOperatorClient csrfToken={issueCrmCsrfToken(session)} readOnly={isCaseLab3LiveArchived("live")} />
      </div>
    </main>
  );
}

import Link from "next/link";

import { issueCrmCsrfToken, requireCrmAdmin } from "@/lib/crm-auth.server";
import CrmSectionNav from "../components/CrmSectionNav";
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CaseLab3CrmPage() {
  const session = await requireCrmAdmin();
  if (!session) {
    return (
      <main className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-xl">
          <p className="text-sm text-black/50" style={{ fontFamily: "var(--font-body)" }}>
            Требуется вход в CRM.
          </p>
          <Link href="/crm/" className="mt-4 inline-flex text-sm text-[#040082] hover:underline" style={{ fontFamily: "var(--font-body)" }}>
            Вернуться ко входу
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fafafa] px-5 py-7 md:px-10 md:py-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-7">
          <CrmSectionNav active="case-lab-3" />
        </div>
        <OrdersClient
          csrfToken={issueCrmCsrfToken(session)}
          initialData={{ orders: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } }}
        />
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";

type CrmSection = "leads" | "case-lab-3" | "check-in";

const links: { href: string; label: string; section: CrmSection }[] = [
  { href: "/crm/", label: "Заявки", section: "leads" },
  { href: "/crm/case-lab-3/", label: "Case Lab III", section: "case-lab-3" },
  { href: "/crm/check-in/", label: "Чек-ин", section: "check-in" },
];

export default function CrmSectionNav({ active }: { active: CrmSection }): React.ReactElement {
  return (
    <nav aria-label="Разделы CRM" className="flex flex-wrap items-center gap-2">
      {links.map((link) => {
        const isActive = link.section === active;
        return (
          <Link
            key={link.section}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
              isActive
                ? "bg-black text-white"
                : "border border-black/[0.08] bg-white text-black/55 hover:bg-black/[0.04] hover:text-black"
            }`}
            style={{ fontFamily: "var(--font-body)" }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import ScrollReveal from "../components/ScrollReveal";

const team = [
  {
    name: "Асылбек Нугуманов",
    role: "Маркетолог",
    initials: "АН",
  },
  {
    name: "Данияр Косназаров",
    role: "Маркетолог",
    initials: "ДК",
    lead: true,
  },
  {
    name: "Амиржан Жампеисов",
    role: "Маркетолог",
    initials: "АЖ",
  },
];

export default function Team() {
  return (
    <section aria-label="Команда" className="relative bg-white py-16 md:py-40 px-6 md:px-10 overflow-clip">
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1078px] mx-auto">
        <ScrollReveal>
          <div className="mb-12 md:mb-20">
            <span
              className="text-gray text-[11px] mb-3 block leading-[1.58] uppercase tracking-wider"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Кто проводит
            </span>
            <h2
              className="text-black text-[clamp(22px,3.5vw,42px)] font-bold leading-[1.12] uppercase tracking-[0.02em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Команда
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {team.map((member, i) => (
            <ScrollReveal key={member.name} delay={i * 0.12}>
              <div className="flex flex-col items-start">
                {/* Avatar */}
                <div
                  className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mb-5 ${
                    member.lead
                      ? "bg-[#040082] text-white"
                      : "bg-black/[0.04] text-black/40"
                  }`}
                >
                  <span
                    className="text-[18px] md:text-[22px] font-bold leading-none"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {member.initials}
                  </span>
                </div>

                {/* Name */}
                <h3
                  className="text-black text-[16px] md:text-[18px] font-normal leading-[1.25] mb-1"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {member.name}
                </h3>

                {/* Role */}
                <p
                  className="text-black/40 text-[13px] leading-[1.5] font-light"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {member.role}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

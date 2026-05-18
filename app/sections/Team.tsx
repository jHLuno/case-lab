"use client";

import Image from "next/image";
import ScrollReveal from "../components/ScrollReveal";

const team = [
  {
    name: "Данияр Косназаров",
    role: "Советник президента Narxoz University\nОснователь Case Lab\nex-CMO Qazaq Republic, KPMG\n50+ компаний в консалтинге",
    photo: "/daniyar-kosnazarov.webp",
    objectPos: "center 20%",
    scale: "140%",
    lead: true,
  },
  {
    name: "Асылбек Нугуманов",
    role: "Маркетолог Narxoz Business School",
    photo: "/asylbek-nugumanov.webp",
    objectPos: "center 15%",
    scale: "100%",
  },
  {
    name: "Амиржан Жампеисов",
    role: "Маркетолог",
    photo: "/amirkhan-zhampeisov.webp",
    objectPos: "center 20%",
    scale: "140%",
  },
];

export default function Team() {
  return (
    <section aria-label="Команда" className="relative bg-white py-16 md:py-40 px-6 md:px-10 overflow-clip">
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1078px] mx-auto">
        <ScrollReveal>
          <div className="mb-12 md:mb-20 text-center">
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
              <div
                className={`relative flex flex-col items-center text-center p-8 md:p-10 rounded-[20px] border transition-[border-color,box-shadow] duration-200 h-full ${
                  member.lead
                    ? "border-[#040082]/20 bg-[#040082]/[0.02] shadow-[0_8px_32px_-8px_rgba(4,0,130,0.1)]"
                    : "border-black/[0.06] bg-white"
                }`}
              >
                {/* Photo */}
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden mb-6 relative">
                  <Image
                    src={member.photo}
                    alt={member.name}
                    fill
                    className="object-cover"
                    style={{ objectPosition: member.objectPos, scale: member.scale }}
                    sizes="96px"
                  />
                </div>

                {/* Name */}
                <h3
                  className="text-black text-[17px] md:text-[20px] font-normal leading-[1.25] uppercase tracking-[0.02em] mb-2"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {member.name}
                </h3>

                {/* Role */}
                <p
                  className="text-black/50 text-[14px] leading-[1.5] font-light whitespace-pre-line"
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

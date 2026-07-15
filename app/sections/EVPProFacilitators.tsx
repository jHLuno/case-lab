import Image from "next/image";

const facilitators = [
  {
    name: "Данияр Косназаров",
    role: "Ведущий",
    description: "Советник президента Narxoz University, основатель Case Lab, ex-CMO Qazaq Republic и KPMG. 50+ компаний в консалтинге.",
    photo: "/daniyar-kosnazarov.webp",
    position: "center 20%",
    scale: "140%",
  },
  {
    name: "Амиржан Жампеисов",
    role: "Со-ведущий",
    description: "CEO Founder's Hub, ex-Founder ARN Labs, координатор проекта Case Lab. Развитие стартапов и работа с предпринимательскими проектами.",
    photo: "/amirzhan-zhampeisov.webp",
    position: "center 20%",
    scale: "140%",
  },
];

export default function EVPProFacilitators() {
  return (
    <section aria-labelledby="evp-facilitators-title" className="relative bg-white px-6 py-20 md:px-10 md:py-36">
      <div className="absolute top-0 left-0 h-px w-full divider-gradient" />
      <div className="mx-auto max-w-[1078px]">
        <h2
          data-evp-reveal
          id="evp-facilitators-title"
          className="max-w-[13ch] text-[clamp(29px,4.4vw,56px)] font-bold leading-[1.06] tracking-[0.02em] uppercase text-black"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Кто проведёт EVP Pro
        </h2>

        <div className="mt-14 grid gap-10 md:mt-20 md:grid-cols-2 md:gap-16">
          {facilitators.map((facilitator) => (
            <article key={facilitator.name} data-evp-reveal>
              <div className="evp-facilitator-portrait relative aspect-[4/3] overflow-hidden bg-[#040082]/10">
                <Image
                  src={facilitator.photo}
                  alt={facilitator.name}
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  className="evp-facilitator-image object-cover grayscale"
                  style={{ objectPosition: facilitator.position, scale: facilitator.scale }}
                />
              </div>
              <p className="mt-5 text-[12px] font-medium uppercase tracking-[0.14em] text-[#075C43]" style={{ fontFamily: "var(--font-body)" }}>
                {facilitator.role}
              </p>
              <h3 className="mt-3 text-[22px] font-bold uppercase leading-[1.15] tracking-[0.02em] text-black md:text-[30px]" style={{ fontFamily: "var(--font-heading)" }}>
                {facilitator.name}
              </h3>
              <p className="mt-4 max-w-[48ch] text-[15px] leading-[1.5] text-black/65 md:text-[17px]" style={{ fontFamily: "var(--font-body)" }}>
                {facilitator.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

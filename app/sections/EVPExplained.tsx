export default function EVPExplained() {
  return (
    <section
      aria-labelledby="evp-explained-title"
      className="bg-white px-6 py-12 md:px-10 md:py-14"
    >
      <div className="mx-auto grid max-w-[1440px] gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-20 lg:gap-28">
        <div data-evp-reveal className="max-w-[360px]">
          <h2
            id="evp-explained-title"
            className="max-w-[12ch] text-[clamp(28px,3.1vw,46px)] font-bold leading-[1.06] tracking-[0.02em] uppercase text-black"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            EVP - <span className="text-[#075C43]">{"{ НЕ }"}</span>{" "}
            <span className="whitespace-nowrap">HR-СЛОГАН.</span>
          </h2>
          <p
            className="mt-5 max-w-[30ch] text-[15px] leading-[1.5] text-black/65 md:text-[17px]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Это причина, по которой сильные люди выбирают вашу компанию, остаются в ней и рекомендуют её другим.
          </p>
        </div>

        <div data-evp-reveal className="max-w-[720px]">
          <p
            className="max-w-[38ch] text-[clamp(22px,2.3vw,34px)] leading-[1.22] text-black"
            style={{ fontFamily: "var(--font-body)" }}
          >
            EVP объединяет то, что компания обещает людям, то, как она работает внутри, и то, что о ней слышит рынок.
          </p>
          <p
            className="mt-5 max-w-[58ch] text-[16px] leading-[1.5] text-black/65 md:mt-6 md:text-[18px]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Когда эти части сходятся, компания становится понятным и сильным выбором для нужных ей людей.
          </p>
          <p
            className="mt-8 text-[15px] font-bold uppercase tracking-[0.05em] text-[#075C43] md:mt-10 md:text-[17px]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Наём. Удержание. Репутация.
          </p>
        </div>
      </div>
    </section>
  );
}

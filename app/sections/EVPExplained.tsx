export default function EVPExplained() {
  return (
    <section
      aria-labelledby="evp-explained-title"
      className="bg-white px-6 py-12 md:px-10 md:py-14"
    >
      <div className="mx-auto grid max-w-[1440px] gap-10 md:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.1fr)] md:gap-20 lg:gap-28">
        <div data-evp-reveal className="max-w-[400px]">
          <h2
            id="evp-explained-title"
            className="text-[clamp(28px,3.1vw,46px)] font-bold leading-[1.06] tracking-[0.02em] uppercase text-black"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <span className="whitespace-nowrap">
              EVP — <span className="text-[#075C43]">{"{ПРИЧИНА}"}</span>
            </span>
            <br />
            <span className="whitespace-nowrap">ВЫБРАТЬ ВАС.</span>
          </h2>
          <p
            className="mt-5 max-w-[30ch] text-[15px] leading-[1.5] text-black/65 md:text-[17px]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Это то, благодаря чему сильные люди выбирают вашу компанию, остаются в ней и рекомендуют её другим.
          </p>
        </div>

        <div data-evp-reveal className="max-w-[720px]">
          <p
            className="max-w-[38ch] text-[clamp(22px,2.3vw,34px)] leading-[1.22] text-black"
            style={{ fontFamily: "var(--font-body)" }}
          >
            За шесть часов <span className="text-[#075C43]">EVP PRO</span> вы найдёте ответ на главный вопрос: почему талантливые специалисты должны работать именно у вас.
          </p>
          <p
            className="mt-5 max-w-[58ch] text-[16px] leading-[1.5] text-black/65 md:mt-6 md:text-[18px]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            На его основе создадите сильное позиционирование работодателя и план развития HR-бренда, связанный с конкретными задачами бизнеса.
          </p>
        </div>
      </div>
    </section>
  );
}

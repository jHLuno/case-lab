import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Case Lab",
  description: "Политика обработки персональных данных Case Lab.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white px-8 md:px-10 py-16 md:py-40">
      <div className="max-w-[800px] mx-auto">
        <h1
          className="text-black text-[clamp(24px,3.5vw,42px)] font-bold leading-[1.12] uppercase tracking-[0.02em] mb-12"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Политика конфиденциальности
        </h1>

        <div className="space-y-8 text-black/60 text-[14px] md:text-[15px] leading-[1.6] font-light break-words" style={{ fontFamily: "var(--font-body)" }}>
          <section>
            <h2 className="text-black text-[16px] md:text-[18px] font-normal mb-3 uppercase tracking-[0.02em]" style={{ fontFamily: "var(--font-heading)" }}>
              1. Общие положения
            </h2>
            <p>
              Настоящая Политика конфиденциальности персональных данных (далее — Политика) действует в отношении всей информации, которую ИП «Case Lab» (далее — Case Lab) может получить о пользователе во время использования сайта caselab.kz.
            </p>
          </section>

          <section>
            <h2 className="text-black text-[16px] md:text-[18px] font-normal mb-3 uppercase tracking-[0.02em]" style={{ fontFamily: "var(--font-heading)" }}>
              2. Какие данные мы собираем
            </h2>
            <p className="mb-3">
              Case Lab собирает и обрабатывает следующие персональные данные:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Имя и фамилия</li>
              <li>Адрес электронной почты</li>
              <li>Название компании</li>
              <li>Контактный телефон (при желании)</li>
              <li>Сообщение, которое вы нам отправляете</li>
            </ul>
          </section>

          <section>
            <h2 className="text-black text-[16px] md:text-[18px] font-normal mb-3 uppercase tracking-[0.02em]" style={{ fontFamily: "var(--font-heading)" }}>
              3. Цели обработки данных
            </h2>
            <p className="mb-3">
              Мы используем ваши персональные данные исключительно для следующих целей:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Связь с вами по вопросам записи на диагностику</li>
              <li>Подготовка к сессии и отправка материалов</li>
              <li>Отправка результатов диагностики</li>
              <li>Информирование о новых потоках и материалах (только с вашего согласия)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-black text-[16px] md:text-[18px] font-normal mb-3 uppercase tracking-[0.02em]" style={{ fontFamily: "var(--font-heading)" }}>
              4. Передача данных третьим лицам
            </h2>
            <p>
              Case Lab не передаёт персональные данные третьим лицам без вашего явного согласия, за исключением случаев, предусмотренных законодательством Республики Казахстан. Мы не продаём и не обмениваем ваши данные.
            </p>
          </section>

          <section>
            <h2 className="text-black text-[16px] md:text-[18px] font-normal mb-3 uppercase tracking-[0.02em]" style={{ fontFamily: "var(--font-heading)" }}>
              5. Хранение и защита данных
            </h2>
            <p>
              Мы принимаем необходимые организационные и технические меры для защиты персональных данных от неправомерного или случайного доступа, уничтожения, изменения, блокирования, копирования, распространения, а также от иных неправомерных действий третьих лиц.
            </p>
          </section>

          <section>
            <h2 className="text-black text-[16px] md:text-[18px] font-normal mb-3 uppercase tracking-[0.02em]" style={{ fontFamily: "var(--font-heading)" }}>
              6. Ваши права
            </h2>
            <p className="mb-3">
              Вы имеете право:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Получить информацию о том, какие данные о вас хранятся</li>
              <li>Потребовать исправления неточных данных</li>
              <li>Потребовать удаления данных («право на забвение»)</li>
              <li>Отозвать согласие на обработку данных</li>
            </ul>
            <p className="mt-3">
              Для реализации любого из этих прав напишите нам на hello@caselab.kz.
            </p>
          </section>

          <section>
            <h2 className="text-black text-[16px] md:text-[18px] font-normal mb-3 uppercase tracking-[0.02em]" style={{ fontFamily: "var(--font-heading)" }}>
              7. Cookies
            </h2>
            <p>
              Сайт использует cookies для корректной работы аналитики и улучшения пользовательского опыта. Вы можете отключить cookies в настройках браузера, однако это может ограничить функциональность сайта.
            </p>
          </section>

          <section>
            <h2 className="text-black text-[16px] md:text-[18px] font-normal mb-3 uppercase tracking-[0.02em]" style={{ fontFamily: "var(--font-heading)" }}>
              8. Контакты
            </h2>
            <p>
              По всем вопросам, связанным с обработкой персональных данных, обращайтесь: hello@caselab.kz, Алматы, Казахстан.
            </p>
          </section>

          <p className="text-gray text-[13px] pt-4 border-t border-black/5">
            Последнее обновление: май 2026
          </p>
        </div>
      </div>
    </main>
  );
}

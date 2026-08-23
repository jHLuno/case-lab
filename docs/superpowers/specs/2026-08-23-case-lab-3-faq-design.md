# Case Lab 3 FAQ

## Goal

Add a compact FAQ section immediately after the Case Lab 3 ticket pricing section. It should answer the five practical questions a visitor is likely to have before buying a ticket without changing the existing pricing or checkout flow.

## Design

- Create a dedicated `CaseLab3FAQ` client component.
- Render it after `CaseLab3Tickets` and before the footer in `CaseLab3Page`.
- Use the existing Case Lab 3 CSS module and visual language: white background, dark typography, thin dividers, and lavender accent.
- Implement an accessible accordion with one item open by default, keyboard-operable buttons, `aria-expanded`, and an explicit panel relationship.
- Keep the section responsive and avoid adding a new dependency.

## Questions And Answers

1. **Где проходит Case Lab III?**
   24 сентября в Алматы, в Narxoz Business School.
2. **На каком языке?**
   Основная программа проходит на русском языке.
3. **Во сколько начало и сколько длится?**
   Время начала и точную продолжительность сообщим в подтверждении участия после покупки билета.
4. **Будет ли запись?**
   Полная запись мероприятия не входит в программу; на встрече будут доступны материалы и видеоотзывы прошлых потоков, указанные в составе билета.
5. **Можно ли вернуть или передать билет?**
   Передать билет можно, предварительно написав на `hello@caselab.kz`. Отказаться от участия и запросить возврат можно до начала мероприятия по тому же адресу; возврат рассматривается по условиям публичной оферты и законодательству Республики Казахстан.

The copy must not promise a full event recording, a specific start time, or a fixed duration that is not present in the project source of truth.

## Verification

- Run TypeScript validation without incremental output.
- Run the production build.
- Confirm the FAQ is ordered after the ticket section in the page composition.

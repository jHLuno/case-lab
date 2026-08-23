# Полный аудит страницы `/case-lab-3`

Дата аудита: 23 августа 2026 года  
Аудируемая версия: текущее состояние рабочего дерева репозитория `/Users/arney/icomat-replica`  
Режим: только аудит, без исправления исходного кода

## 1. Резюме

Страница имеет узнаваемую визуальную концепцию, корректный базовый порядок заголовков и качественно реализованное мобильное модальное меню. При этом выпускать текущую версию без исправлений рискованно: найдены подтвержденные WCAG-нарушения, обрезание контента на поддерживаемых размерах экрана, неработающие переходы и checkout-fallback, неверная структурированная разметка события, чрезмерная загрузка изображений и постоянная фоновая работа CPU/GPU.

Главные проблемы:

1. На мобильных устройствах описания спикеров почти не видны: белый полупрозрачный текст выводится на почти белом фоне.
2. На ширине 320 px заголовки и карточки реально обрезаются; на viewport `768x600` обрезается текст активного кейса спикера.
3. Карусель кейсов движется бесконечно, не имеет паузы и продолжает двигаться при `prefers-reduced-motion: reduce`.
4. При сбое или отключении JavaScript исчезают hero, navbar, билеты, FAQ и CTA из-за SSR-разметки с `opacity: 0` и отсутствия статического фона.
5. До первого экрана инициируется загрузка 10 изображений общим исходным весом около 5,59 МБ, потому что оптимизация Next Image отключена, а изображения помечены eager.
6. Без `NEXT_PUBLIC_CASE_LAB_3_CHECKOUT_URL` все CTA ведут обратно к `#tickets`; заданный URL не валидируется по протоколу и хосту.
7. Страница события отсутствует в sitemap и внутренних ссылках, не имеет `Event` schema и наследует нерелевантную услугу стоимостью 175 000 ₸.
8. Страница обещает видеозаписи отзывов в составе билета, но все видео URL пусты, а кнопки просмотра отключены.
9. Один из 11 route-тестов падает; существующие тесты проверяют исходный текст регулярными выражениями и закрепляют вредную eager-загрузку.

### Количество дефектов

| Критичность | Количество | Значение |
|---|---:|---|
| P0 Blocking | 0 | Полной недоступности маршрута не обнаружено |
| P1 Major | 17 | Исправить до публикации/продажи билетов |
| P2 Minor | 27 | Исправить следующим обязательным проходом |
| P3 Polish | 11 | Технический долг и качество реализации |
| **Всего** | **55** | Без учета положительных находок и непроверяемых рисков |

## 2. Оценка качества

| # | Направление | Оценка | Главная причина |
|---|---|---:|---|
| 1 | Accessibility | 1/4 | Контраст, motion, focus, отсутствие bypass и потеря семантики спикеров |
| 2 | Performance | 1/4 | 5,59 МБ eager-изображений, WebGL/RAF, тяжелый initial JS |
| 3 | Responsive | 1/4 | Подтвержденное обрезание на 320 px и `768x600` |
| 4 | Theming | 2/4 | Палитра последовательна, но цвета и focus states почти полностью hard-coded |
| 5 | Anti-patterns | 2/4 | Есть характер, но много переокругленных карточек, автодвижения и ложных affordance |
| **Итого** |  | **7/20** | **Poor: требуется серьезная доработка** |

Дополнительные оценки, не входящие в базовые 20 баллов:

| Направление | Оценка | Главная причина |
|---|---:|---|
| SEO | 1/4 | Orphan page, нет Event schema, неверный Twitter metadata, нет URL в sitemap |
| Security/privacy | 2/4 | Слабый CSP и невалидируемый внешний checkout URL |
| Code quality/testing | 2/4 | TypeScript и ESLint чистые, но один тест падает и нет поведенческого/a11y покрытия |

## 3. Методика и фактические проверки

Проведены:

- Статический аудит всего дерева импортов маршрута: page, sections, navbar, footer, cases, motion-компоненты, schema, config, sitemap, robots, manifest.
- Браузерная проверка в Chromium на `1440x900`, `768x600`, `390x844` и `320x568`.
- Проверка accessibility tree, keyboard focus, hash-навигации, reduced motion и страницы без JavaScript.
- Проверка DOM: landmarks, заголовки, schema, canonical, OG/Twitter metadata, focusable elements, horizontal overflow.
- Проверка runtime console/errors и локальных security headers.
- Проверка размеров исходных изображений.
- `npx tsc --noEmit --incremental false`.
- Точечный ESLint по полному дереву маршрута.
- `node --test tests/case-lab-3-assets.test.mjs tests/case-lab-3-process-and-testimonials.test.mjs`.

Браузер подтвердил:

- `document.scrollWidth` не превышает viewport, но это достигается в том числе через `overflow-x: hidden/clip`; внутренний контент на 320 px все равно шире контейнеров и визуально обрезается.
- На 390 px navbar занимает `y=16..82`, а строка `Case Lab III` начинается на `y=66`, то есть элементы перекрываются на 16,5 px.
- Mobile speaker copy имеет `color: rgba(255,255,255,.68)` поверх светлого градиента `#fff -> #e8eaf2`.
- В `768x600` активный desktop speaker copy имеет `clientHeight=196`, `scrollHeight=210`, то есть 14 px текста скрыты из-за `overflow: hidden`.
- При reduced motion `scrollLeft` карусели продолжает меняться и зацикливаться.
- При блокировке JavaScript семь ключевых motion-оберток остаются с `opacity: 0`; hero остается белым с белым текстом.
- В accessibility tree desktop-версии виден заголовок кейса, но имя и роль спикера не связаны с ним; дубликаты marquee объявляются повторно.
- После клика по пункту мобильного меню активным элементом становится `BODY`, то есть focus теряется.
- Route DOM содержит 32 `<img>`, три JSON-LD объекта типов `Organization`, `Service`, `WebSite`, но не `Event`.
- Twitter title остается главной страницей, в то время как Open Graph title относится к Case Lab 3.

## 4. P1 Major

### P1-01. Нечитаемые описания спикеров на mobile

**Категория:** Accessibility, UI, responsive  
**Где:** `app/case-lab-3/case-lab-3.module.css:1012-1026`, `app/case-lab-3/case-lab-3.module.css:1326-1363`  
**Что происходит:** базовый темный цвет описания из `.speakerMobileCase p:last-child` переопределяется более поздним mobile-правилом на `rgba(255,255,255,.68)`. Родитель имеет почти белый градиент. Контраст близок к 1:1, текст практически исчезает.  
**Влияние:** пользователь не может прочитать основное описание трех кейсов. Это не косметика, а потеря контента и WCAG AA failure.  
**Стандарт:** WCAG 1.4.3 Contrast (Minimum), минимум 4.5:1 для текста этого размера.  
**Как исправить:** удалить белое mobile-переопределение; использовать темный route-token, например эквивалент `#4f4e5b`; измерить контраст на каждой точке градиента; добавить automated contrast check или screenshot regression для mobile.  
**Рекомендуемая команда:** `$impeccable colorize`, затем `$impeccable audit`.

### P1-02. Контент обрезается на ширине 320 px

**Категория:** Responsive, UI  
**Где:** `app/case-lab-3/case-lab-3.module.css:20-28`, `1366-1396`; `app/components/CaseLab3Page.tsx:15`  
**Что происходит:** `.contentShell` сохраняет искусственный heading shift и уменьшенную ширину. На 320 px браузер зафиксировал `scrollWidth > clientWidth` у speaker section, mobile cards, copy blocks и H3. Например, H3 имеет `clientWidth=168`, `scrollWidth=264`. Внешний `overflow-x-clip` скрывает проблему вместо reflow. Hero CTA также имеет контентную ширину 300 px внутри 280 px.  
**Влияние:** окончания заголовков и текста физически не видны; пользователь не может проскроллить к обрезанной части.  
**Стандарт:** WCAG 1.4.10 Reflow; поддержка 320 CSS px.  
**Как исправить:** на `max-width: 640px` сбросить heading shift/margin и использовать `width: 100%`; убрать desktop inset из mobile cards; ограничить CTA через `max-width:100%` и адаптивный horizontal padding; убрать `overflow-x-clip` как маскировку и повторно проверить 320 px и 400% zoom.  
**Рекомендуемая команда:** `$impeccable adapt`.

### P1-03. Текст кейса обрезается на коротком tablet/desktop viewport

**Категория:** Responsive, content loss  
**Где:** `app/case-lab-3/case-lab-3.module.css:888-1001`, `1239-1253`  
**Что происходит:** desktop speaker stage активируется уже с 768 px, использует две жестко ограниченные grid-строки и `overflow:hidden`. На `768x600` browser measurement: `clientHeight=196`, `scrollHeight=210`; нижняя часть текста скрыта. Скриншот подтверждает обрыв последней строки.  
**Влияние:** часть описания недоступна пользователям небольших ноутбуков, split-screen и browser zoom.  
**Стандарт:** WCAG 1.4.10 Reflow, 1.4.4 Resize Text.  
**Как исправить:** переключать на mobile semantic stack не только по ширине, но и при короткой высоте; убрать `overflow:hidden` у copy; разрешить grid-row расти; сократить декоративные изображения раньше; протестировать `768x600`, `1024x600`, zoom 200% и landscape tablet.  
**Рекомендуемая команда:** `$impeccable adapt`.

### P1-04. Бесконечная карусель нельзя остановить, reduced motion игнорируется

**Категория:** Accessibility, motion, performance  
**Где:** `app/sections/Cases.tsx:59-141`, `159-214`; `app/globals.css:159-190`  
**Что происходит:** desktop запускает бесконечную CSS-анимацию, mobile меняет `scrollLeft` каждый animation frame. Нет pause/play, остановки при focus или hover. Reduced-motion CSS прямо сохраняет 25-секундную анимацию; browser test показал движение `scrollLeft` и в reduced mode.  
**Влияние:** пользователи с vestibular/attention disorders не могут остановить движение; контент уезжает во время чтения; расходуются CPU и батарея.  
**Стандарт:** WCAG 2.2.2 Pause, Stop, Hide; WCAG 2.3.3 как улучшенный ориентир.  
**Как исправить:** при reduced motion выводить статичный/manual-scroll список; автоматически ставить паузу при hover, keyboard focus, pointer/touch interaction и `document.hidden`; останавливать RAF, когда секция вне viewport.  
**Рекомендуемая команда:** `$impeccable animate`.

### P1-05. Ключевой контент невидим без JavaScript или при hydration failure

**Категория:** Progressive enhancement, accessibility, reliability  
**Где:** `app/components/ScrollReveal.tsx:29-45`; `app/components/Navbar.tsx:174-179`; `app/sections/CaseLab3Hero.tsx:11-22`; `app/case-lab-3/case-lab-3.module.css:355-374`; `app/globals.css:220-229`  
**Что происходит:** SSR выводит motion wrappers с `opacity:0`, navbar тоже стартует невидимым. Hero WebGL имеет `ssr:false`, а статический синий фон назначается только после client hook. CSS fallback относится только к `.gsap-hidden`, а не к Framer Motion. Browser с заблокированными scripts показал белый hero с белым текстом, невидимый navbar и пустые зоны билетов/FAQ.  
**Влияние:** при медленной сети, CSP-блокировке, JS error или отключенном JS исчезает основное предложение и путь покупки.  
**Стандарт:** progressive enhancement; WCAG 1.3.1 и 1.4.3 как фактическая потеря/невидимость контента.  
**Как исправить:** SSR должен быть видимым по умолчанию; скрывать элементы только после установки `js/motion-ready` класса; задать серверный статический фон hero; WebGL накладывать поверх как enhancement; добавить `@media (scripting:none)` для всех reveal wrappers.  
**Рекомендуемая команда:** `$impeccable harden`.

### P1-06. Скрытый при scroll navbar остается в tab order

**Категория:** Accessibility, keyboard  
**Где:** `app/components/Navbar.tsx:95-117`, `174-179`, `199-245`  
**Что происходит:** navbar визуально уезжает на `y:-120`, но ссылки и кнопки остаются focusable. Keyboard focus может попасть на control за пределами viewport.  
**Влияние:** пользователь не понимает, где находится focus и почему Enter активирует невидимую ссылку.  
**Стандарт:** WCAG 2.4.7 Focus Visible, 2.4.11 Focus Not Obscured.  
**Как исправить:** navbar всегда должен возвращаться при `focusin`/`:focus-within`; не скрывать его, пока внутри focus; альтернативно синхронно убирать скрытые controls из tab order и accessibility tree, но первый вариант лучше.  
**Рекомендуемая команда:** `$impeccable harden`.

### P1-07. Focus rings не проходят non-text contrast или удалены

**Категория:** Accessibility, keyboard  
**Где:** `app/globals.css:209-218`; `app/case-lab-3/case-lab-3.module.css:1169-1172`; `app/components/Navbar.tsx:288-295`, `317-357`; `app/sections/CaseLab3Tickets.tsx:27-30`  
**Что происходит:** глобальный темно-синий outline почти исчезает на темно-синем ticket background; FAQ outline `#afa8ff` на белом около 2.13:1; mobile CTA использует `focus-visible:outline-none` и показывает только небольшое движение стрелки.  
**Влияние:** keyboard users не видят текущий control, особенно на основном purchase path.  
**Стандарт:** WCAG 1.4.11 Non-text Contrast, 2.4.7 Focus Visible.  
**Как исправить:** создать surface-aware focus token; использовать двухслойный ring, например светлый внешний и темный внутренний; обеспечить минимум 3:1 к соседнему цвету; не заменять focus только transform-анимацией стрелки.  
**Рекомендуемая команда:** `$impeccable colorize`.

### P1-08. Desktop-раздел спикеров теряет имена, роли и полный список для assistive technology

**Категория:** Accessibility, semantics  
**Где:** `app/sections/CaseLab3Speakers.tsx:11-39`, `74-99`, `187-245`  
**Что происходит:** все figures с именами помечены `aria-hidden="true"`; поле `role` вообще не рендерится; одновременно доступен только один article, остальные переключаются scroll progress без controls и announcement. Accessibility snapshot показывал заголовок кейса без связанного имени/роли.  
**Влияние:** screen-reader пользователь не может последовательно узнать всех спикеров, их должности и кейсы; scroll-controlled смена состояния недоступна с клавиатуры.  
**Стандарт:** WCAG 1.3.1 Info and Relationships, 2.1.1 Keyboard, 4.1.2 Name, Role, Value.  
**Как исправить:** оставить статичный semantic list всех трех speakers/cases в DOM и accessibility tree; visual choreography сделать decorative; вывести `company`, `role`, title и description в каждом article; если нужен carousel, добавить prev/next, current state и live announcement без автосмены.  
**Рекомендуемая команда:** `$impeccable harden`.

### P1-09. Нет skip link к основному содержимому

**Категория:** Accessibility, navigation  
**Где:** `app/layout.tsx:65-101`  
**Что происходит:** `<main id="main">` существует, но до него нет первой focusable ссылки `Перейти к содержимому`.  
**Влияние:** keyboard и screen-reader users вынуждены проходить fixed navigation при каждом открытии страницы.  
**Стандарт:** WCAG 2.4.1 Bypass Blocks.  
**Как исправить:** добавить первой интерактивной сущностью skip link на `#main`, скрытую до focus; убедиться, что target не перекрывается fixed navbar.  
**Рекомендуемая команда:** `$impeccable harden`.

### P1-10. 5,59 МБ eager-изображений и отключенная оптимизация Next Image

**Категория:** Performance, Core Web Vitals  
**Где:** `next.config.ts:23-25`; `app/components/Navbar.tsx:186-193`; `app/sections/CaseLab3Hero.tsx:96-115`; `app/sections/Cases.tsx:165-184`  
**Что происходит:** `images.unoptimized: true` отключает responsive transform. SSR инициирует/preloads 10 изображений: logo 575 553 bytes, три hero images 691 288 bytes и шесть far-below-fold case images 4 325 890 bytes; всего 5 592 731 bytes исходных файлов. `sizes` не уменьшает файл без loader.  
**Влияние:** LCP конкурирует с ненужными ресурсами; mobile тратит трафик, memory и время декодирования; ухудшаются CWV и SEO.  
**Стандарт:** Core Web Vitals; Next.js production image guidance.  
**Как исправить:** включить Next image optimization или responsive image CDN; сжать/resize logo; убрать eager у archive и secondary hero images; preload оставить только фактическому LCP; использовать static imports и корректные `sizes`; измерить Lighthouse на production build.  
**Рекомендуемая команда:** `$impeccable optimize`.

### P1-11. Постоянная работа WebGL и RAF даже вне viewport

**Категория:** Performance, battery, INP  
**Где:** `app/components/SpecularButton.tsx:219-276`; `app/sections/Cases.tsx:73-129`; `app/globals.css:179-189`  
**Что происходит:** SpecularButton создает WebGL render loop на весь срок жизни route; `getBoundingClientRect()` вызывается при каждом pointer move. Mobile cases меняют `scrollLeft` каждый frame независимо от видимости. Desktop marquee постоянно анимируется с permanent `will-change`.  
**Влияние:** лишняя нагрузка CPU/GPU, нагрев, battery drain, возможные long frames и ухудшение INP/scroll smoothness.  
**Стандарт:** performance best practices, Vercel React rendering guidance.  
**Как исправить:** предпочтительно заменить эффект кнопки CSS; иначе останавливать loop при brightness 0, вне viewport и при hidden tab; кэшировать geometry; запускать cases RAF только рядом с viewport; снимать `will-change` вне animation; профилировать production trace.  
**Рекомендуемая команда:** `$impeccable optimize`.

### P1-12. Checkout URL не валидируется и имеет нерабочий fallback

**Категория:** Security, conversion, reliability  
**Где:** `app/lib/caseLab3.ts:1`; `app/sections/CaseLab3Hero.tsx:68-90`; `app/sections/CaseLab3Tickets.tsx:27`; `app/components/Navbar.tsx:53-55`, `213-216`, `339-343`; `app/components/Footer.tsx:45-47`  
**Что происходит:** любое значение build-time env передается в `window.location.assign` и `href`; scheme/host не проверяются. При отсутствии env fallback равен `#tickets`. В локальном runtime все три anchor CTA имели `href="#tickets"`, а hero button также назначал тот же fragment. Env отсутствует в `.env.example`.  
**Влияние:** purchase path зацикливается внутри страницы. Ошибочная/скомпрометированная конфигурация может отправить пользователя на фишинговый домен или опасную схему.  
**Стандарт:** CWE-20 Improper Input Validation; OWASP Unvalidated Redirects.  
**Как исправить:** валидировать URL на server/build через `new URL`; разрешить только `https:` и точный allowlist checkout host/path; запретить credentials и неожиданные query params; fail build при отсутствии обязательного URL; документировать env; рендерить безопасное недоступное состояние вместо hash-loop.  
**Рекомендуемая команда:** `$impeccable harden`.

### P1-13. Ссылка «Все кейсы» ведет в несуществующий fragment

**Категория:** Functional UX, internal linking, SEO  
**Где:** `app/sections/Cases.tsx:217-230`; `app/components/CaseLab3Page.tsx:13-33`  
**Что происходит:** href равен `#news`, но route не содержит `id="news"`. Browser подтвердил отсутствие target.  
**Влияние:** ссылка меняет URL, но ничего не показывает и не прокручивает; обещанный archive недоступен.  
**Стандарт:** WCAG 2.4.4 Link Purpose; Google crawlable links guidance.  
**Как исправить:** вести на реальную страницу archive или `/#news`; если destination нет, убрать CTA до появления route; добавить navigation test, проверяющий существование target.  
**Рекомендуемая команда:** `$impeccable harden`.

### P1-14. Для покупки не хватает существенных данных о событии

**Категория:** UX, content, SEO, legal risk  
**Где:** `app/case-lab-3/page.tsx:5-16`; `app/sections/CaseLab3Hero.tsx:49-66`, `91`; `app/sections/CaseLab3FAQ.tsx:10-20`; `app/sections/CaseLab3Speakers.tsx:11-39`  
**Что происходит:** не указан год, timezone, время начала/окончания, длительность и полный адрес. Время обещают сообщить только после оплаты. Metadata говорит «три CMO», но первый указан как ex-CMO, а третьим элементом является пара компаний без имени человека. Hero обещает первые 20 билетов, но не показывает остаток и актуальность цены.  
**Влияние:** пользователь не может оценить доступность по расписанию и дорогу до места до оплаты; снижаются trust/conversion; visible content не поддерживает корректную Event schema.  
**Стандарт:** content usability; Google Event content consistency; точность существенной информации оферты.  
**Как исправить:** до checkout показать полную дату с годом, `Asia/Almaty`, start/end или duration, адрес и map link, check-in details, актуальную availability; назвать всех подтвержденных спикеров и точные роли; синхронизировать metadata, visible page, checkout и offer.  
**Рекомендуемая команда:** `$impeccable clarify`.

### P1-15. Состав билета обещает видео, которых нет

**Категория:** UX, trust, content/legal risk  
**Где:** `app/sections/CaseLab3Tickets.tsx:8-13`, `44-51`; `app/sections/CaseLab3Proof.tsx:8-36`, `119-137`; `app/sections/CaseLab3FAQ.tsx:22-24`  
**Что происходит:** в составе билета перечислены «видеозаписи отзывов прошлых потоков», FAQ также говорит, что они доступны. Но все `embedUrl` пустые, а каждая кнопка «Посмотреть видео» disabled.  
**Влияние:** пользователь видит материальное обещание перед оплатой, которое текущая реализация не подтверждает; proof section выглядит незавершенным и снижает доверие.  
**Как исправить:** либо добавить действительные видео и проверить consent/CSP, либо убрать видео из состава билета и заменить controls честным видимым статусом; синхронизировать copy во всех трех местах.  
**Рекомендуемая команда:** `$impeccable clarify`.

### P1-16. Нет Event schema, зато наследуется нерелевантный Service за 175 000 ₸

**Категория:** Technical SEO, structured data  
**Где:** `app/layout.tsx:78`; `app/components/JsonLd.tsx:31-50`; `app/case-lab-3/page.tsx:4-18`  
**Что происходит:** глобально внедряется `Service` «Маркетинговая диагностика» с ценой 175 000 KZT. Страница билетов 7 890/15 000 ₸ не имеет `Event`, `Place`, event dates или ticket `Offer`. Browser подтвердил только `Organization`, `Service`, `WebSite`.  
**Влияние:** поисковик получает неверную primary entity/price и не может использовать event rich results.  
**Стандарт:** Schema.org Event/Place/Offer; Google Event structured data.  
**Как исправить:** ограничить Service schema релевантным route; добавить route-specific Event JSON-LD с ISO date/time и timezone, status, attendanceMode, location/address, organizer, performers/speakers, images и Offer, полностью совпадающими с visible content и checkout. Проверить Rich Results Test.  
**Рекомендуемая команда:** `$impeccable harden`.

### P1-17. Route является orphan page и отсутствует в sitemap

**Категория:** SEO, discoverability  
**Где:** `public/sitemap.xml:3-38`; `app/components/HomePage.tsx:24-40` и поиск ссылок по `app/`  
**Что происходит:** `/case-lab-3/` не указан в sitemap и не имеет crawlable internal link с других индексируемых страниц. Robots route не блокирует, canonical корректен, но discovery оставлен внешним источникам.  
**Влияние:** слабая/медленная индексация и отсутствие внутреннего PageRank.  
**Стандарт:** Sitemaps protocol; Google Search Essentials links guidance.  
**Как исправить:** добавить canonical URL с реальным `lastmod` в generated sitemap; добавить релевантную внутреннюю ссылку с homepage/event archive; не использовать sitemap как замену internal linking.  

## 5. P2 Minor

### P2-01. Fixed navbar перекрывает hero на mobile

**Где:** `app/components/Navbar.tsx:174-185`; `app/case-lab-3/case-lab-3.module.css:355-390`, `1366-1374`  
**Доказательство:** на 390 px navbar заканчивается на `y=82`, `Case Lab III` начинается на `y=66`.  
**Влияние:** бренд-строка визуально скрыта/перемешана с navbar.  
**Как исправить:** добавить hero safe offset от фактической высоты navbar или перенести content ниже fixed header; учитывать `safe-area-inset-top`.  
**Команда:** `$impeccable adapt`.

### P2-02. Роли спикеров не выводятся визуально, заголовок обещает «три человека», но третьего человека нет

**Где:** `app/sections/CaseLab3Speakers.tsx:11-39`, `181-184`, `243-245`, `256-269`  
**Что происходит:** поле `role` не используется ни desktop, ни mobile. Третий item называется `Forte Bank × GForce Grey`, а не именем спикера.  
**Влияние:** пользователь не понимает, кто выступает и почему ему доверять; copy противоречит данным.  
**Как исправить:** вывести имя, должность и компанию каждого спикера; заменить third item подтвержденным человеком или переименовать секцию/metadata.  
**Команда:** `$impeccable clarify`.

### P2-03. После перехода из мобильного меню focus теряется

**Где:** `app/components/Navbar.tsx:48-52`, `317-320`, `339-359`  
**Доказательство:** после клика «Кейсы» URL стал `#cases`, а `document.activeElement` стал `BODY`. Escape корректно возвращает focus, обычный link click нет.  
**Влияние:** keyboard/screen-reader user теряет позицию и вынужден заново искать текущую секцию.  
**Стандарт:** WCAG 2.4.3 Focus Order.  
**Как исправить:** после hash navigation фокусировать target heading с `tabIndex=-1`; при закрытии без навигации возвращать focus toggle.  
**Команда:** `$impeccable harden`.

### P2-04. Shared motion-компоненты неполно учитывают reduced motion

**Где:** `app/components/ScrollReveal.tsx:19-45`; `app/components/Navbar.tsx:174-178`, `235-367`; `app/components/BackToTop.tsx:19-31`  
**Что происходит:** reveal всегда переводит контент на 24 px; navbar/menu масштабируются, вращаются и двигаются; BackToTop использует smooth scrolling.  
**Влияние:** системная настройка пользователя не применяется к часто используемой навигации.  
**Как исправить:** использовать `useReducedMotion`; оставить instant/opacity-only state; отключить stagger, scale и rotation; для scroll использовать `behavior:"auto"`.  
**Команда:** `$impeccable animate`.

### P2-05. Карточки archive выглядят кликабельными, но ничего не делают

**Где:** `app/sections/Cases.tsx:169-172`  
**Что происходит:** non-focusable `<div>` имеет `cursor-pointer`, hover scale, border и shadow, но нет click handler или destination. Browser accessibility snapshot помечает generic как clickable из-за cursor.  
**Влияние:** ложный affordance; pointer и keyboard experience расходятся.  
**Как исправить:** сделать карточки настоящими links с destination и focus state или удалить cursor/hover interaction.  
**Команда:** `$impeccable harden`.

### P2-06. Marquee дублирует контент для screen reader и повторяет имена в alt

**Где:** `app/sections/Cases.tsx:165-214`  
**Что происходит:** весь набор из шести карточек рендерится дважды без `aria-hidden` для clone set. Alt портрета повторяет соседнее visible имя.  
**Влияние:** пользователь слышит 12 карточек вместо 6 и повторяющиеся имена.  
**Стандарт:** WCAG 1.1.1, 1.3.1.  
**Как исправить:** скрыть второй набор от accessibility tree и tab order; у декоративного портрета рядом с именем использовать `alt=""`.  
**Команда:** `$impeccable harden`.

### P2-07. Disabled video controls показывают недоступное действие и неверный alt

**Где:** `app/sections/CaseLab3Proof.tsx:8-36`, `91-97`, `119-137`  
**Что происходит:** видимый текст говорит «Посмотреть видео», хотя кнопки disabled; alt называет статичный портрет видео-отзывом.  
**Влияние:** пользователь видит dead control; assistive description не соответствует изображению.  
**Стандарт:** WCAG 1.1.1; content usability.  
**Как исправить:** не рендерить action без URL; показать обычный текст «Видео скоро» только если это подтвержденный roadmap; alt описывать как портрет или делать пустым при дублирующем имени.  
**Команда:** `$impeccable clarify`.

### P2-08. Hero checkout реализован button вместо link

**Где:** `app/sections/CaseLab3Hero.tsx:68-90`; `app/components/SpecularButton.tsx:295-306`  
**Что происходит:** control меняет location, но имеет button semantics.  
**Влияние:** нельзя copy link/open in new tab; пользователь и assistive tech получают неверный тип действия.  
**Как исправить:** добавить polymorphic anchor variant или стилизованный `<a href>` с тем же visual effect.  
**Команда:** `$impeccable harden`.

### P2-09. Вторичный текст не проходит 4.5:1

**Где:** `app/case-lab-3/case-lab-3.module.css:813-819`; `app/components/Footer.tsx:115-135`  
**Что происходит:** testimonial role `#777684` на белом около 4.46:1; footer text `text-black/50` при 12 px около 3.7:1.  
**Влияние:** мелкий legal/meta text сложнее читать пользователям с low vision.  
**Стандарт:** WCAG 1.4.3.  
**Как исправить:** затемнить role на небольшой шаг; footer поднять примерно до 65% black или измеренного token >=4.5:1.  
**Команда:** `$impeccable colorize`.

### P2-10. Shared Cases нарушает иерархию размеров и сетку route

**Где:** `app/sections/Cases.tsx:144-154`, `217-232`; `app/case-lab-3/case-lab-3.module.css:665-674`, `1382-1393`  
**Что происходит:** mobile H2 может быть 16 px, меньше card titles; `alignToCaseLab` двигает только heading, а CTA возвращается в centered 1078 px container.  
**Влияние:** section heading теряет приоритет, wide layout визуально «прыгает» между сетками.  
**Как исправить:** дать H2 mobile floor 24-32 px и один route shell для heading, marquee и CTA.  
**Команда:** `$impeccable layout`.

### P2-11. Мобильное меню содержит нерелевантный текст про диагностику

**Где:** `app/components/Navbar.tsx:363-372`; route configuration `app/components/CaseLab3Navbar.tsx:12-22`  
**Что происходит:** меню event page завершает copy «Диагностика маркетинга для команд...», не связанной с покупкой билета.  
**Влияние:** смешиваются два продукта и снижается ясность purchase journey.  
**Как исправить:** передавать menu description prop для конкретного route или не показывать generic service copy.  
**Команда:** `$impeccable clarify`.

### P2-12. Слишком широкие Client Component boundaries

**Где:** `app/components/JsonLd.tsx:1`; `app/sections/CaseLab3Proof.tsx:1`; `app/sections/CaseLab3Tickets.tsx:1`; `app/components/Footer.tsx:1`; `app/sections/CaseLab3Hero.tsx:1`  
**Что происходит:** статичный JSON-LD гидратируется; Tickets клиентский только из-за reveal; Footer тянет popup context, хотя route всегда передает href; Proof хранит недостижимое video state при пустых URL.  
**Влияние:** лишний JS, hydration и вероятность client-only failure.  
**Как исправить:** сделать static markup Server Components; выделить accordion/menu/player/WebGL button в минимальные client islands; server-render JSON-LD.  

### P2-13. Initial JS слишком тяжелый для event landing page

**Где:** imports в `CaseLab3Speakers.tsx`, `SpecularButton.tsx`, `Navbar.tsx`, `BackToTop.tsx`, `ScrollReveal.tsx`  
**Что происходит:** существующий production artifact содержал 13 initial scripts, около 992 661 raw / 310 522 gzip bytes; заметные chunks включали GSAP, OGL и Framer Motion.  
**Влияние:** parse/compile/hydration на слабых телефонах до доступности CTA.  
**Как исправить:** убрать OGL из CTA; lazy-load GSAP при приближении speakers; простые threshold/reveal задачи решить CSS/IntersectionObserver; подтвердить bundle analyzer после production build.  

### P2-14. Desktop и mobile speaker layouts одновременно присутствуют в DOM

**Где:** `app/sections/CaseLab3Speakers.tsx:55-175`, `187-272`  
**Что происходит:** оба представления SSR/hydrate; CSS только скрывает одно. Это создает 12 image elements и дублированный контент. Ниже fold синхронно запускается `useLayoutEffect` с GSAP.  
**Влияние:** больше HTML, DOM, image bookkeeping и hydration work.  
**Как исправить:** иметь одно semantic content tree; visual layers делать отдельными decorative overlays; инициализировать GSAP при proximity через IntersectionObserver; использовать `useEffect`, если pre-paint mutation не обязательна.  

### P2-15. Дублирующая/лишняя загрузка шрифтов

**Где:** `app/layout.tsx:2-18`, `72-75`; `app/globals.css:4-34`, `47-48`  
**Что происходит:** Inter и Bebas загружаются через `next/font`, хотя используются только как fallback после Gilroy/Benzin; четыре local fonts вручную preload и также объявлены через `@font-face`. Existing artifact показывал 11 preload tags, 7 unique files, около 206 568 bytes.  
**Влияние:** network competition и лишние font files до first render.  
**Как исправить:** перевести Gilroy/Benzin на `next/font/local`; удалить ненужные Google fallbacks и ручные preload; позволить Next preload только реально используемые faces.  

### P2-16. CSP ослаблен `unsafe-inline` и имеет пробелы

**Где:** `next.config.ts:3-20`; inline script `app/layout.tsx:79-98`  
**Что происходит:** production `script-src` разрешает `'unsafe-inline'`; `connect-src` разрешает любой `*.supabase.co`; отсутствуют `object-src`, `base-uri`, `form-action`, `frame-ancestors`, `upgrade-insecure-requests`. Inline MutationObserver закрепляет потребность в unsafe-inline.  
**Влияние:** CSP слабее ограничивает XSS/exfiltration; wildcard Supabase позволяет запросы к чужому проекту после script execution.  
**Стандарт:** CSP Level 3; OWASP Secure Headers.  
**Как исправить:** удалить extension-specific inline script; перейти на nonce/hash CSP; ограничить точный Supabase origin; добавить `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` или checkout allowlist, `frame-ancestors 'none'`, `upgrade-insecure-requests`; не полагаться только на X-Frame-Options.  

### P2-17. Будущие video iframe одновременно заблокированы CSP и недостаточно изолированы

**Где:** `app/sections/CaseLab3Proof.tsx:81-89`; `next.config.ts:10-12`  
**Что происходит:** iframe имеет широкий `allow`, нет `sandbox` и `referrerPolicy`; CSP не содержит `frame-src`, поэтому внешний host унаследует `default-src 'self'` и будет заблокирован. Сейчас ветка dormant из-за пустых URL.  
**Влияние:** после добавления видео оно либо не заработает, либо при поспешном расширении CSP получит лишние capabilities/privacy leakage.  
**Как исправить:** точный privacy-enhanced frame host в `frame-src`; click-to-load/consent; минимальный `allow`; строгий `sandbox`; `referrerPolicy="strict-origin-when-cross-origin"` или строже.  

### P2-18. Twitter/X metadata относится к homepage

**Где:** `app/case-lab-3/page.tsx:4-18`; `app/layout.tsx:49-55`  
**Что происходит:** route переопределяет Open Graph, но не `twitter`. Browser подтвердил OG title Case Lab 3 и Twitter title «Маркетинговая диагностика...».  
**Влияние:** неправильный social preview и message mismatch в кампании.  
**Как исправить:** задать route-specific `twitter.card`, title, description, image и alt; проверить X Card Validator/preview.  

### P2-19. Open Graph image не подготовлен для Case Lab 3

**Где:** `app/case-lab-3/page.tsx:11-17`; asset `/caselab2.webp`  
**Что происходит:** передана только строка без width, height, type и alt; исходник 3:2 относится к предыдущему мероприятию и не содержит даты/оффера Case Lab 3.  
**Влияние:** непредсказуемый crop, слабая узнаваемость, недоступный preview.  
**Как исправить:** отдельный 1200x630 asset с safe area; metadata object с dimensions, MIME и descriptive alt; использовать тот же asset в Twitter.  

### P2-20. Organization `sameAs` связывает бренд с чужими/личными аккаунтами

**Где:** `app/components/JsonLd.tsx:24-28`; сравнение с `app/components/Footer.tsx:93-109`  
**Что происходит:** Case Lab Organization sameAs содержит Narxoz Business School и личные profiles; фактический brand Instagram из footer отсутствует.  
**Влияние:** Knowledge Graph может неверно объединить entities.  
**Как исправить:** оставить только официальные Case Lab profiles; founders/partners моделировать отдельными `Person`/`Organization` с корректной связью.  

### P2-21. Достоверность и consent testimonials не подтверждены

**Где:** `app/sections/CaseLab3Proof.tsx:8-35`  
**Что происходит:** публикуются names, employers, photos и attributed quotes; у Елены Афониной грамматическая ошибка «Увидел»; roles/quotes требуют owner verification.  
**Влияние:** ошибка снижает credibility; отсутствие документированного publication consent создает privacy/publicity risk.  
**Как исправить:** сверить цитаты и должности с первоисточником; исправить род; хранить явное согласие, scope, срок и withdrawal procedure.  

### P2-22. Linked legal pages публикуют избыточные персональные идентификаторы

**Где:** `app/privacy/page.tsx:394-403`; `app/offer/page.tsx:428-440`  
**Что происходит:** публично указаны полный ИИН, адрес до квартиры и личный телефон. Это не непосредственный дефект UI route, но страницы доступны из его footer.  
**Влияние:** scraping, identity fraud и personal safety risk. Законность раскрытия зависит от требований Казахстана и должна быть проверена юристом.  
**Как исправить:** провести legal review; оставить только обязательные реквизиты; использовать business contact/registered address, если закон допускает; применять purpose limitation/data minimization.  

### P2-23. Route tests падают и проверяют implementation text вместо поведения

**Где:** `tests/case-lab-3-process-and-testimonials.test.mjs:23-30`; `tests/case-lab-3-assets.test.mjs:29-38`  
**Что происходит:** 10/11 тестов прошли, `testimonial proof uses poster-first external players` упал, ожидая `/Видео скоро появится/`. Тесты читают source regex; подсчет `embedUrl` может совпасть с function parameter. Asset test закрепляет eager-loading hero images.  
**Влияние:** CI красный; tests дают ложную уверенность и мешают performance fix.  
**Как исправить:** заменить source regex на rendered behavior tests; проверять enabled/disabled состояние, visible copy, iframe lifecycle, focus restore; убрать требование eager для всех изображений; добавить viewport/reduced-motion checks.  

### P2-24. Цвета, radius и focus не оформлены в route design tokens

**Где:** `app/case-lab-3/case-lab-3.module.css` по всему файлу; inline/Tailwind цвета в shared components  
**Что происходит:** десятки повторов `#040082`, `#afa8ff`, `rgba(...)`, radius 18-40 px и surface-specific values. Глобальные tokens существуют, но route почти не использует их. Именно cascade hard-coded цветов вызвал P1-01.  
**Влияние:** сложно гарантировать contrast и согласованно менять brand theme; ошибки переопределения повторяются.  
**Как исправить:** определить route semantic tokens `--cl-bg`, `--cl-text`, `--cl-muted`, `--cl-focus`, `--cl-accent`; привязать компоненты к surface roles; добавить contrast matrix.  
**Команда:** `$impeccable document`, затем `$impeccable colorize`.

### P2-25. Нет поведенческих, accessibility и responsive regression tests

**Где:** `tests/`  
**Что происходит:** два test files проверяют исходные строки. Нет keyboard menu, FAQ, broken fragment, checkout configuration, no-JS, reduced motion, 320 px reflow, schema и contrast tests.  
**Влияние:** текущие P1 дефекты проходят CI.  
**Как исправить:** добавить component/E2E behavior tests; axe-core или эквивалент; screenshot/DOM assertions на 320, 390, 768x600; тест reduced motion; metadata/schema tests; broken fragment checker.  

### P2-26. Site navigation и footer находятся внутри `<main>`

**Где:** `app/layout.tsx:99-101`; `app/components/CaseLab3Page.tsx:15-32`  
**Что происходит:** root main оборачивает весь route, а route внутри рендерит primary nav и site footer.  
**Влияние:** landmark hierarchy сообщает assistive technology, что global navigation/footer являются основным содержимым страницы.  
**Стандарт:** HTML landmarks; WCAG 1.3.1.  
**Как исправить:** global nav/footer вынести за main; либо route layout должен рендерить `<main>` только вокруг content sections. Сохранить ровно один main.  

### P2-27. Hero WebGL не имеет надежного fallback при ошибке renderer/context

**Где:** `app/sections/CaseLab3Hero.tsx:11-22`; `app/components/Grainient.jsx:139-151`; `app/case-lab-3/case-lab-3.module.css:355-374`  
**Что происходит:** WebGL2 renderer создается без надежного route-level error state; static blue class зависит только от reduced motion, а не от WebGL support/failure.  
**Влияние:** unsupported/context-limited device может получить белый фон под белым hero text.  
**Как исправить:** постоянный CSS gradient как base layer; WebGL canvas только поверх; catch creation/context lost и оставлять base intact.  
**Команда:** `$impeccable harden`.

## 6. P3 Polish / technical debt

### P3-01. Mobile utility controls меньше рекомендуемых 44x44 px

**Где:** `app/components/Navbar.tsx:235-245`; `app/components/BackToTop.tsx:32-45`  
**Что:** controls 40x40 px. WCAG 2.2 AA minimum 24 px выполняется, но 44 px остается лучшим ergonomic target.  
**Как исправить:** увеличить до 44x44/48x48 без уменьшения edge spacing.

### P3-02. Открытие social links в новой вкладке не объявлено

**Где:** `app/components/Footer.tsx:93-109`  
**Что:** `target="_blank"` безопасно дополнен `noopener noreferrer`, но пользователь не предупрежден о новой вкладке.  
**Как исправить:** добавить visually hidden «откроется в новой вкладке» или не использовать `_blank`.

### P3-03. H1 не содержит название Case Lab 3

**Где:** `app/sections/CaseLab3Hero.tsx:49-57`; `app/case-lab-3/page.tsx:5`  
**Что:** single H1 равен только «Как это было сделано на самом деле», а brand/event name находится в отдельном `<p>`.  
**Влияние:** слабее соответствие title/H1 branded event query.  
**Как исправить:** естественно включить `Case Lab 3` в H1 или доступное продолжение H1, не превращая заголовок в keyword stuffing.

### P3-04. Manifest содержит гарантированно неверные icon paths и пустое имя

**Где:** `public/favicons/site.webmanifest:1`  
**Что:** manifest ссылается на `/android-chrome-*.png`, тогда как assets находятся в `/favicons/`; `name` и `short_name` пусты.  
**Влияние:** broken install icons и пустая app identity.  
**Как исправить:** исправить paths на `/favicons/...`, заполнить Case Lab names, проверить manifest validator.

### P3-05. JSON-LD serialization не экранирует `<`

**Где:** `app/components/JsonLd.tsx:61-72`  
**Что:** raw `JSON.stringify` передается в `dangerouslySetInnerHTML`. Текущие данные статичны, поэтому exploit сейчас не подтвержден, но будущие CMS values смогут разорвать script context.  
**Как исправить:** следовать Next.js guidance: `JSON.stringify(data).replace(/</g, '\\u003c')`; сохранять generation server-side.

### P3-06. Глобальное подавление hydration warnings и вечный MutationObserver маскируют ошибки

**Где:** `app/layout.tsx:65`, `77-98`  
**Что:** warning suppression стоит на html/body; inline observer постоянно удаляет extension-specific `bis_skin_checked`.  
**Влияние:** реальные hydration mismatch труднее обнаружить; глобальная runtime работа не относится к product behavior и ослабляет CSP.  
**Как исправить:** удалить broad suppression и extension workaround; исправлять конкретные deterministic mismatch в источнике.

### P3-07. `SpecularButton` использует устаревшие props после первого render

**Где:** `app/components/SpecularButton.tsx:128-140`, `142-285`  
**Что:** `propsRef` инициализируется один раз и не синхронизируется; WebGL продолжит использовать старые values после prop update. На текущем route props постоянны, поэтому defect latent.  
**Как исправить:** обновлять `propsRef.current` при render/effect или сделать component contract immutable и явно это зафиксировать.

### P3-08. `Grainient.jsx` выпадает из strict TypeScript и не освобождает context явно

**Где:** `app/components/Grainient.jsx:1-290`; `tsconfig.json`  
**Что:** большой WebGL component не type-checked; cleanup останавливает RAF/observers, но не вызывает явный context loss, в отличие от SpecularButton.  
**Как исправить:** перенести в TypeScript или добавить checked JSDoc; освобождать geometry/program/context при unmount/navigation.

### P3-09. FAQ анимирует layout property

**Где:** `app/case-lab-3/case-lab-3.module.css:1206-1215`  
**Что:** transition `grid-template-rows` вызывает layout на протяжении 300 ms. На пяти элементах impact мал, но это не самая дешевая animation path.  
**Как исправить:** native `<details>` или measured/contained disclosure; reduced motion уже должен отключать transition.

### P3-10. `priority` и `loading="eager"` на logo дублируются; API устаревает

**Где:** `app/components/Navbar.tsx:186-193`, `278-285`  
**Что:** logo 575 KB получает high priority, хотя фактический LCP browser определил как hero image; в Next.js 16 предпочтителен `preload`, а не legacy `priority`.  
**Как исправить:** сначала уменьшить logo; убрать eager/priority; preload использовать только если field data доказывает, что logo является LCP.

### P3-11. Sitemaps dates и покрытие других linked routes неточны

**Где:** `public/sitemap.xml:3-38`; `app/privacy/page.tsx:41-43`  
**Что:** privacy visible update позже sitemap `lastmod`; `/offer/` также отсутствует.  
**Влияние:** поисковику передаются ненадежные recrawl signals.  
**Как исправить:** генерировать sitemap из route/content data и реальных modification dates, не поддерживать вручную.

## 7. Системные проблемы

### 7.1. Маскировка overflow вместо responsive reflow

`overflow-x:hidden/clip` задан глобально и на route wrapper. Поэтому документ формально не имеет horizontal scrollbar, но внутренние H3 и cards шире контейнера и обрезаются. Проверка только `document.scrollWidth` дает ложноположительный результат «mobile готов».

### 7.2. Motion считается обязательным состоянием, а не enhancement

Navbar и ScrollReveal скрыты до client animation; hero фон зависит от WebGL; cases всегда движутся. Правильная системная модель: полный контент виден в SSR, motion добавляется только после capability/preference check.

### 7.3. Shared components смешивают разные продукты

Navbar mobile copy рекламирует диагностику на event page; global Service schema попадает на event; shared Cases имеет другую сетку/типографику. Route props меняют отдельные labels, но не весь product context.

### 7.4. Тесты проверяют текст исходника

Regex tests не проверяют доступность или реальное поведение и уже закрепляют eager-loading. Из-за этого UI может проходить большинство tests при серьезных runtime defects.

### 7.5. Нет единой системы surface-aware contrast/focus

Один глобальный синий focus ring применяется и к белому, и к синему фону; route colors дублируются вручную. Это системная причина нескольких WCAG failures.

## 8. Design / anti-pattern verdict

**Вердикт:** страница не выглядит полностью шаблонной или безликой, но проходит anti-slop test лишь частично.

Что работает:

- Сильная кобальтово-фиолетовая палитра и recognizable Benzin/Gilroy typography.
- Hero и speaker choreography имеют конкретную event-концепцию, а не обычный SaaS hero.
- Нет gradient text; общая композиция заметно отличима от стандартного landing template.

Что ослабляет дизайн:

- Radius 22-40 px почти на каждой card/section создает over-rounded visual language.
- Mobile speakers превращаются в card-within-card: outer card, media card и gradient copy card.
- Repeated uppercase headings и маленькие tracked kickers используются почти как обязательный scaffold.
- Cases cards обещают интерактивность hover/cursor, но не имеют действия.
- Бесконечный marquee применяется как декоративная динамика без пользовательского контроля.
- Shared Cases и Footer визуально принадлежат другой сетке/масштабу, чем специализированные Case Lab 3 sections.
- На mobile типографическая иерархия ломается: Cases H2 может быть меньше card title.

Рекомендация по дизайну: не менять brand direction, а упростить систему поверхностей, уменьшить число вложенных карточек/radius, восстановить одну route-grid и сделать motion управляемым.

## 9. Положительные находки

- Route возвращает 200 и имеет корректный self-canonical `https://caselab.kz/case-lab-3/` с согласованным trailing slash.
- `lang="ru"` установлен корректно.
- Есть один H1 и в целом логичная H1 -> H2 -> H3 структура.
- Major sections используют `aria-labelledby`; process и ticket benefits оформлены semantic lists.
- FAQ использует native buttons, `aria-expanded`, `aria-controls`, labeled regions и крупные click areas.
- Mobile menu имеет dialog semantics, focus trap, initial focus, Escape, focus restoration по Escape, scroll lock, inert/aria-hidden background.
- Social external links защищены `noopener noreferrer`; reverse tabnabbing не найден.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, restrictive Permissions Policy и strict referrer policy присутствуют; production наблюдение также показало HSTS.
- Нет сторонних analytics/pixel scripts, cookies, local/session storage, форм и PII в URL на самом route.
- Current empty iframe URLs означают, что сейчас third-party video provider не получает данные.
- GSAP использует scoped context/matchMedia cleanup; RAF, timers, listeners и observers в большинстве компонентов снимаются.
- Hero WebGL отключается при reduced motion, хотя остальные motion paths покрыты не полностью.
- Изображения имеют зарезервированные размеры через fill-контейнеры, что помогло получить runtime CLS 0 в локальном измерении.
- TypeScript и точечный ESLint прошли без ошибок.

## 10. Приоритетный план исправлений

### Этап 1. Блокирующие выпуск P1

1. Исправить mobile speaker contrast и 320/short-tablet clipping.
2. Остановить auto-marquee при reduced motion и добавить pause controls.
3. Сделать SSR/no-JS содержимое видимым; добавить постоянный CSS fallback hero.
4. Исправить focus indicators, hidden navbar focus и skip link.
5. Сделать speaker content статически доступным для assistive technology.
6. Включить image optimization и убрать far-below-fold eager loading.
7. Валидировать checkout URL и fail closed при отсутствии configuration.
8. Исправить broken `#news` destination.
9. Опубликовать полные event facts и синхронизировать speaker claims.
10. Либо предоставить обещанные videos, либо убрать обещание до checkout.
11. Добавить Event schema, убрать нерелевантный Service с event route.
12. Добавить route в sitemap и внутреннюю навигацию.

### Этап 2. Performance и архитектура

1. Сузить client boundaries.
2. Убрать постоянный WebGL/RAF; lazy-init GSAP.
3. Объединить desktop/mobile speaker semantic tree.
4. Перенести local fonts в `next/font/local` и убрать duplicate preload.
5. Усилить CSP и подготовить безопасную video embed policy.

### Этап 3. Контент, SEO и визуальная система

1. Исправить Twitter/OG assets и H1 alignment.
2. Исправить Organization sameAs и testimonial data/consent.
3. Ввести route design/focus tokens.
4. Упростить nested/over-rounded card system и выровнять shared sections.
5. Исправить manifest и generated sitemap.

### Этап 4. Regression protection

1. Заменить regex tests на rendered behavior tests.
2. Добавить keyboard, reduced-motion, no-JS и broken-link tests.
3. Добавить viewport matrix `320`, `390`, `768x600`, desktop и zoom checks.
4. Добавить accessibility/contrast scanner и production Lighthouse budget.
5. Повторить полный аудит после исправлений.

## 11. Что не удалось подтвердить

- Реальное значение `NEXT_PUBLIC_CASE_LAB_3_CHECKOUT_URL` намеренно не читалось из `.env*`; внешний checkout, payment security, consent и privacy notice не аудировались.
- Production deployment может отличаться от текущего dirty worktree. Runtime UI-проверки выполнены против локального `http://localhost:3000/case-lab-3/`.
- Field Core Web Vitals, Search Console indexation, реальный conversion rate и social debugger не доступны.
- Event year/time/address, remaining early-bird inventory, speaker confirmations, testimonial consent и точность цитат требуют подтверждения владельцем данных.
- Schema проверена в source/rendered DOM, но не отправлялась в Google Rich Results Test.
- Screen reader NVDA/VoiceOver и физические iOS/Android устройства не использовались; accessibility tree и keyboard flow проверены в Chromium.
- Полный `npm run build` не запускался во время активного dev server, чтобы не вмешиваться в текущую `.next`; TypeScript и targeted ESLint прошли.

## 12. Результаты команд

| Проверка | Результат |
|---|---|
| `npx tsc --noEmit --incremental false` | Passed, ошибок TypeScript нет |
| Targeted ESLint по route tree | Passed, ошибок нет |
| Route tests | 10 passed, 1 failed |
| Browser console | Только dev/HMR сообщения; application errors не обнаружены |
| Browser page errors | Не обнаружены |
| Local runtime CLS | 0 в тестовом прогоне; не является field/production метрикой |
| Horizontal document scroll | Не обнаружен, но внутреннее обрезание подтверждено на 320 px |

После исправлений следует повторить `$impeccable audit`; для итогового визуального прохода использовать `$impeccable polish`.

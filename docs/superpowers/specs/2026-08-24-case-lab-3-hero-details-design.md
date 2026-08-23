# Case Lab 3 Hero Details Design

## Goal

Упростить информационный блок в hero на `/case-lab-3`, сохранив число `24` и увеличив размер оставшегося текста на `2px`.

## Scope

- Сохранить число `24` без изменений.
- Оставить рядом только три строки: `СЕНТЯБРЯ`, `10:00–14:00`, `NARXOZ BUSINESS SCHOOL`.
- Удалить год, часовой пояс, длительность и адрес из видимого hero-блока.
- Изменить размер текста `.caseRoomDetails span` с `10px` на `12px`.
- Не менять purchase-блок, адаптивную структуру или другие секции страницы.

## Implementation

Изменить JSX в `app/sections/CaseLab3Hero.tsx` и одно CSS-значение в `app/case-lab-3/case-lab-3.module.css`.

## Verification

Проверить TypeScript без генерации incremental-файлов и убедиться по diff, что изменены только hero-текст и размер шрифта.

# Case Lab 3 Topic Width Design

## Goal

Уменьшить количество строк у длинных тем в Hero на `/case-lab-3`, слегка увеличив доступную ширину текста и дав Qara Studios немного больше места.

## Scope

- Сохранить для обычных тем максимальную ширину `.caseRoomCaseFeaturedDescription` в `20ch`.
- Установить для темы Qara Studios отдельную максимальную ширину `22ch`.
- Сохранить общий контейнер карточек, отступы, типографику, мобильную структуру и тексты без изменений.
- Не менять ширину обычных подписей карточек и другие секции страницы.

## Implementation

Сохранить `max-width: 20ch` в существующем селекторе `.caseRoomCase .caseRoomCaseFeaturedDescription` и добавить Qara-плашке modifier-класс в `app/sections/CaseLab3Hero.tsx`. Для `.caseRoomCase .caseRoomCaseFeaturedDescriptionWide` задать `max-width: 22ch`; более специфичные правила переопределят общее ограничение `.caseRoomCase span { max-width: 18ch; }` только для нужных тем.

## Verification

Проверить CSS source-контракт, прогнать Case Lab 3 тесты, detector со scope `layout`, TypeScript, lint, production build и `git diff --check`. Визуальная проверка в браузере не входит в автоматическую проверку.

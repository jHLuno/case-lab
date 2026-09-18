# CRM Case Lab 3 Pagination Design

## Goal

Make the `/crm/case-lab-3/` order list usable when there are more orders than fit on one screen by showing 30 orders per page and allowing CRM admins to move between pages.

## Design

The existing admin orders API already accepts `page` and `pageSize` and returns `pagination.totalPages`. The change stays in `app/crm/case-lab-3/OrdersClient.tsx`: keep the active page in client state, request the selected page with a fixed page size of 30, and render compact page navigation below the table.

Changing the environment or any order filter resets the active page to 1. Switching pages preserves the current filters. Navigation buttons expose disabled states and `aria-current` for the active page. The visible range is shown as `N–M из K заказов`; an empty result displays `0 из 0 заказов`.

## Scope and invariants

- No database, migration, API, export, authentication, or dependency changes.
- Existing filtering and CSV export behavior remains unchanged.
- The API remains the source of truth for the total count and number of pages.
- Visual styling follows the existing CRM card, border, and typography tokens.

## Verification

Run the repository's TypeScript check, lint script, and production build. No browser-based visual verification is required for this small client-only control change.

# CRM Case Lab 3 Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 30-orders-per-page navigation to the Case Lab 3 CRM order table.

**Architecture:** Keep pagination client-side in `OrdersClient.tsx`, using the existing `/api/admin/case-lab-3/orders` contract. The client sends the active page and a fixed page size of 30, resets the page when filters change, and renders compact accessible controls from the API's `totalPages` value.

**Tech Stack:** Next.js App Router, React client component, TypeScript, Tailwind utility classes, existing admin orders API.

## Global Constraints

- Do not change database schema, migrations, dependencies, authentication, API contracts, or export behavior.
- Preserve existing CRM styles and filtering behavior.
- Keep all page navigation keyboard-operable with visible focus and correct disabled/current semantics.

### Task 1: Add page state and request parameters

**Files:**
- Modify: `app/crm/case-lab-3/OrdersClient.tsx`

**Interfaces:**
- Consumes: existing `OrderList.pagination` response from `/api/admin/case-lab-3/orders`.
- Produces: order requests with `page` set to the active page and `pageSize` set to `30`.

- [ ] **Step 1: Define the fixed page size and active page state**

  Add `const ORDERS_PAGE_SIZE = 30;` near the existing constants and add `const [page, setPage] = useState(1);` beside the current order state.

- [ ] **Step 2: Send the active page to the existing API**

  Change the order-loading effect's URLSearchParams initialization to:

  ```ts
  const params = new URLSearchParams({
    environment,
    page: String(page),
    pageSize: String(ORDERS_PAGE_SIZE),
  });
  ```

  Add `page` to the effect dependency list.

- [ ] **Step 3: Reset to the first page when the result set changes**

  In the existing environment, search, payment-status, and ticket-status change handlers, call `setPage(1)` before updating the corresponding filter state. Keep page changes themselves independent so current filters remain active while navigating.

### Task 2: Render accessible pagination controls

**Files:**
- Modify: `app/crm/case-lab-3/OrdersClient.tsx`

**Interfaces:**
- Consumes: `pagination.page`, `pagination.pageSize`, `pagination.total`, and `pagination.totalPages`.
- Produces: compact controls with previous/next buttons, page-number buttons, and a visible result range.

- [ ] **Step 1: Add a page-item helper**

  Add a small pure helper that returns all page numbers when there are at most seven pages and otherwise returns the first page, last page, current page, adjacent pages, and string ellipses between non-consecutive numbers.

- [ ] **Step 2: Add the result range and navigation below the table**

  After the table section, render a bordered white row containing:

  ```tsx
  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);
  ```

  Show `rangeStart–rangeEnd из pagination.total заказов`, a `Назад` button, page buttons, and a `Вперёд` button. Disable `Назад` on page 1, `Вперёд` on the last page, and all navigation while `loading`. Mark the active page button with `aria-current="page"`.

- [ ] **Step 3: Keep the controls quiet for a single page**

  Show the range summary whenever the order list is rendered, but show page buttons only when `pagination.totalPages > 1`. Preserve the existing loading and empty-state rows.

### Task 3: Verify the change

**Files:**
- No additional files.

- [ ] **Step 1: Run the TypeScript check**

  Run `npx tsc --noEmit --incremental false` and expect exit code 0.

- [ ] **Step 2: Run lint**

  Run `npm run lint` and expect exit code 0.

- [ ] **Step 3: Run the production build**

  Run `npm run build` and expect exit code 0.

- [ ] **Step 4: Inspect the final diff**

  Run `git diff --check` and `git status --short`; confirm only the pagination client and the two scoped planning documents changed, while the pre-existing untracked `tmp/` directory remains untouched.

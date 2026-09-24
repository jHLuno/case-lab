# Case Lab III Live Archive Design

## Goal

Close the ended Case Lab III public live experience in production while preserving all event records and keeping the CRM view available as a read-only archive.

## Behavior

- In production, `/case-lab-3/live` and `/case-lab-3/live/leaderboard` return the site's 404 experience.
- In production, public live data and mutation endpoints return `410 Gone`; the participant session `DELETE` remains available so an existing browser can clear its cookie.
- In production, the CRM live page remains available to authenticated CRM administrators and displays the existing snapshot without edit, analysis, timing, award, tie-break, or participant-reset controls.
- Every CRM live mutation endpoint rejects requests in production, including direct requests that bypass the hidden controls. CRM read endpoints remain available.
- Development and automated test behavior remain enabled.
- No database migration, SQL mutation, record deletion, answer edit, award edit, or leaderboard formula change is included. The existing database leaderboard remains intact; only public access to it is closed.

## Security and data boundaries

- The archival rule is enforced server-side for page and API requests.
- The CRM archive continues to require the existing CRM authentication and authorization.
- All API responses remain non-cacheable, and the archive does not expose new data beyond the existing authenticated CRM snapshot.

## Verification

- Unit and integration tests prove that production public requests are rejected, CRM writes are rejected, CRM reads remain available, and non-production behavior remains active.
- TypeScript and production build checks run before release.
- After deployment, read-only HTTP checks confirm the public routes are unavailable and the public API returns `410`; no production data writes are part of verification.

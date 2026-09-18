# Meta Pixel on the two public landing pages

## Scope

Enable Meta Pixel `1317409210320189` only on these exact routes:

- `/`
- `/case-lab-3` (with or without a trailing slash)

Do not load or invoke Meta Pixel on CRM, order, ticket, private-offer, privacy, insight, offer, or other routes.

## Architecture

Replace the event-specific pixel component with a route-aware client component mounted from the root layout. The component will use the App Router pathname to decide whether tracking is enabled. It will initialize the Meta Pixel library once, then send `PageView` for the initial eligible route and for every subsequent client-side navigation to an eligible route.

The component will remember the last pathname it tracked so React effect re-runs do not duplicate the same page view. Navigating away from an eligible route will not emit an event. Navigating back to an eligible route will emit a new `PageView`.

The no-JavaScript tracking image is omitted because a root-layout fallback cannot safely determine client-side route changes and could track excluded pages. The requested browser-network behavior depends on JavaScript and will be covered by the normal Pixel request.

## Content security policy

Allow `connect.facebook.net` and `www.facebook.com` only for the two eligible routes. Other routes keep their existing CSP without Meta origins. The proxy remains the server-side source of truth for route-scoped CSP.

## Event flow

1. An eligible pathname mounts or activates the tracker.
2. The Meta bootstrap creates `fbq`, queues `init` for pixel `1317409210320189`, and loads `fbevents.js`.
3. Once the bootstrap is ready, the tracker calls `fbq('track', 'PageView')`.
4. Meta processes the queued event and issues the browser request to `www.facebook.com/tr` with `ev=PageView`.
5. On an eligible App Router navigation, the tracker sends another `PageView` without reinitializing the pixel.

## Verification

Automated tests will assert that:

- the root layout mounts the route-aware component once;
- `/case-lab-3` no longer mounts a second pixel;
- the allowlist contains exactly `/` and `/case-lab-3`;
- the component initializes the configured pixel and tracks `PageView` on eligible pathname changes;
- CSP enables Meta origins on both eligible paths and not globally.

Run the targeted regression test first, followed by TypeScript checking and a production build. Browser visual verification is outside scope, but the production deployment can later be checked in DevTools by filtering Network for `facebook.com/tr` and confirming `ev=PageView`.

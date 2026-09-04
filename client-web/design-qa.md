# Design QA

## Target

OpenQuester redesign attachment, covering sign-in, discovery, creation, lobby, gameplay, results, packages, editor, and settings at 360 px, 768 px, and 1280 px widths.

## Automated source checks

- Source logo and crown assets are used.
- Space Grotesk and IBM Plex Mono are self-hosted.
- Theme, accent, board layout, language, and reduced-motion preferences persist locally.
- Feature UI strings route through localization with English fallback.
- No CSS gradients or hand-drawn replacement icons are used.

## Preview integration findings

- The tested preview was built without an API base URL, so `/v1/*` requests returned the Pages SPA document instead of API JSON.
- Package discovery also sent `order=DESC`, while the deployed API accepts lowercase `asc` or `desc` only.
- The development API session cookie used `SameSite=Lax`; it could not be attached to credentialed requests from the cross-site `pages.dev` preview.
- The Discord authorization start endpoint currently returns HTTP 500 because browser OAuth is not configured in the development API deployment.
- CORS preflight from the tested Pages preview is accepted and allows credentials.

The client build now defaults preview artifacts to the development API, rejects successful non-JSON API responses, and refuses hosted CI builds with no API URL. Package sort direction and the hosted development session-cookie policy are corrected. Native select elements were replaced with a styled, keyboard-accessible Radix Select primitive.

## Automated verification

- Client generated-contract drift, formatting, lint, type checking, unit tests, and production build pass.
- Client tests: 14 passed across 5 files.
- Server schema validation, lint, build, and the complete existing server suite pass.
- Server suite: 578 passed across 67 suites; the new hosted-cookie regression suite adds 8 passing cases.
- The corrected package query returns HTTP 200 JSON from the development API.
- Environment validation accepts the development API URL and intentionally rejects a hosted build with no API URL.

## Browser inspection

Status: completed against the deployed branch preview at 360 px, 768 px, and 1280 px widths.

- Package discovery loaded real development API data without failed requests at every target width.
- Mobile, tablet, and desktop screenshots confirm that package cards, search, filters, primary actions, and navigation remain visible without page-level horizontal overflow.
- The sign-in route renders correctly at 360 px.
- The shared Radix Select opens with the keyboard and displays the styled theme choices correctly.
- The avatar input uses the branded picker rather than the browser's default file control.
- The mobile editor keeps its unsaved state and all six package actions visible. The large question board remains intentionally horizontally scrollable on narrow screens.
- The focused live-preview browser suite passed: 2 tests in 11.4 seconds.
- The local application browser suite passed: 6 tests, with live-only cases skipped unless a preview URL is supplied.

Screenshot evidence is generated under `client-web/test-results/` by `tests/e2e/live-preview.spec.ts` for package discovery, sign-in, settings/selects, and the mobile editor.

## Final result

The rebuilt web preview passes its client, server, contract, build, responsive, and live browser checks. Package discovery and the reported native-looking controls are fixed in the deployed preview.

Two authentication deployment tasks remain outside the client artifact:

- Deploy the server cookie-policy change before cross-site preview sessions can be shared with the development frontend.
- Configure the development API's Discord client ID, client secret, web base URL, and exact callback URI in both the server environment and Discord developer portal. Until then, the live Discord start endpoint will continue returning HTTP 500.

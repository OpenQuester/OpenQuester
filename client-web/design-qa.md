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

Status: pending explicit approval to run Playwright/browser automation against the rebuilt preview.

The visual comparison, responsive overflow review, interaction checks, accessibility scan, and screenshot evidence must be recorded here before release promotion.

## Final result

Blocked until browser inspection is approved and completed.

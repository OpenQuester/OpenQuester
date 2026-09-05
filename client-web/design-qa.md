# Design QA

## Target

OpenQuester redesign attachment, covering sign-in, discovery, creation, lobby, gameplay, results, packages, editor, and settings at 360 px, 768 px, and 1280 px widths.

## Scope of this record

This file states only what has actually been checked, and in which theme. An
earlier version reported localization, responsive behaviour and browser
inspection as complete when they were not; that overstatement is what allowed a
light-theme contrast failure and a 27% localization gap to ship past review.

## Verified by automated check

- Locale parity: `npm run check:locales` fails the build when any locale is
  missing a key that `en.json` defines. All three locales are currently in sync
  at 288 keys.
- Generated contracts: `npm run generate:api:check` fails on drift between
  `openapi/schema.json` and the generated REST and socket types.
- Socket coverage: the client subscribes to `GENERATED_SERVER_SOCKET_EVENTS`
  rather than a hand-written list, so a new server event cannot go unhandled.
- Environment: hosted CI builds are refused when `VITE_API_URL` is unset.

## Verified by measurement

Contrast ratios were computed for every token pair that carries text, in both
themes and for all four accents. Every pair listed below now meets WCAG 2.1 AA
(4.5:1 for body text):

| Pair | Dark | Light |
| --- | --- | --- |
| `--accent` on `--bg` | 12.83 | 5.81 |
| `--accent` violet / lime / coral on `--bg` | ≥ 8.4 | 7.08 / 6.37 / 5.92 |
| `--faint` on `--bg` | 6.57 | 5.06 |
| `--faint` on `--card` | 5.92 | 5.48 |
| `--dim` on `--card` | 6.87 | 7.80 |

`--accent-fill` keeps the saturated brand colour for button and chip
backgrounds, where `--button-text` supplies the contrast.

## Not yet verified

These need a browser and a running API, and have not been re-run since the
current round of changes:

- Visual comparison against the redesign artboards. The Claude Design project
  was not reachable from the review session, so no screen has been diffed
  against the intended design.
- Responsive passes at 360 / 768 / 1280 px.
- The mobile chat sheet, the mobile navigation active state, and the editor's
  keyboard drag-and-drop, in a real browser with a screen reader.
- Any end-to-end run: `npm test`, `npm run typecheck`, `npm run lint` and
  `npm run test:e2e` have not been executed against the current tree.

## Deployment tasks outside the client

- Deploy the server cookie-policy change before cross-site preview sessions can
  be shared with the development frontend.
- Configure the development API's `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
  `WEB_BASE_URL` and the exact `DISCORD_REDIRECT_URI` in both the server
  environment and the Discord developer portal. The start endpoint now fails
  fast with a clear configuration error when any of these is missing.
- `POST /v1/auth/logout` replaced the previous `GET`. Any client still calling
  the `GET` form will receive a 404.

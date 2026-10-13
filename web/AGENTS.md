# web/AGENTS.md — browser client source of truth

Use this file for changes under `web/`. The root `AGENTS.md` routes here.

## Stack

React 19 + TypeScript (strict) + Vite, TanStack Router and Query, Zustand,
Tailwind CSS 4, Radix Dialog, i18next, socket.io-client. Tests: Vitest +
Testing Library, Playwright. Node 22.

## Commands (from `web/`)

```bash
npm run dev          # Vite on :5173; proxies /v1 and /socket.io to OQ_API_PROXY (default http://localhost:3000)
npm run typecheck
npm run lint
npm run format       # prettier; CI runs format:check
npm test             # unit + component tests
npm run gen:api      # regenerate src/api/schema.d.ts after openapi/schema.json changes
npm run check:api    # CI: fails when schema.d.ts is stale
npm run e2e:full     # Docker: Postgres, Redis, S3, server, seed, Playwright, teardown
npm run e2e:stack -- up | restart | down   # keep the backend running while iterating
npm run e2e          # Playwright only (stack and app already running; OQ_WEB_URL to reuse a dev server)
OQ_SCREENSHOTS=1 npm run e2e   # also saves a screenshot of every phase to web/screenshots/
OQ_WEB_URL=https://<deploy>.pages.dev OQ_LIVE_PACKAGE_ID=3 npx playwright test -c playwright.live.config.ts
                     # smoke: a full game on a deployed site against its real server
```

## Layout

```text
src/api/        openapi-fetch client, generated schema.d.ts, type aliases
src/game/       protocol.ts (socket contract), reducer.ts (pure), selectors.ts,
                connection.ts (socket lifecycle), store.ts (zustand), media.ts
src/features/   screens: auth, home, packages, upload (.siq/.oq import), editor, create-game, settings, game (lobby + play)
src/ui/         small design-system components
src/theme/      token sets ([data-theme] blocks) and the theme registry
src/i18n/       en / uk / ru resources
e2e/            Playwright specs, seed + helpers, local backend stack
functions/      Cloudflare Pages Functions proxying /v1 and /socket.io to the API
```

## Rules

- The server is authoritative. Game state changes only in `reduce()` in response
  to server events; a `game-data` snapshot (sent on every join/rejoin) replaces
  everything. No optimistic scoring.
- Every unavailable action names a `DisabledReason` from `selectors.ts`, which
  mirrors `docs/specs/game-state-matrix.md`. The dock always shows the phase,
  the one action for your role and what happens next.
- `game/protocol.ts` mirrors the server DTOs in `server/src/domain/types/**`
  (openapi lags in places). Keep both in sync when a socket payload changes.
- Colours, radii and fonts come from CSS variables in `src/theme/themes.css`;
  never hard-code a colour in a component. A new theme is a `[data-theme]`
  block plus an entry in `themes.ts`.
- All user-facing text goes through i18next keys in `src/i18n/locales/*.json`.
- Use `cn()` from `src/lib/cn.ts` for class names so later utilities win.
- The package editor (`features/editor/`) edits an id-keyed tree (`model.ts`)
  through pure functions in `ops.ts`; the store keeps undo history and one
  store per open editor. Drafts and media live in IndexedDB (`drafts.ts`)
  until Publish, which reuses the upload flow. `validate.ts` follows
  `docs/specs/package-validation-spec.md`: critical issues block Publish.
  Drag and drop is native HTML5; every drag has a Move dialog equivalent for
  touch and keyboard.
- Layouts must work at 375 px wide with no horizontal scroll; the e2e
  `expectNoHorizontalScroll` check runs on phone, tablet and desktop.

## Deploy

The server's Docker image (`docker/Dockerfile`) also builds `web/` and serves it
for every non-API path (`WebAppController`, `WEB_APP_DIR`), so one container on one
port answers both the app and `/v1` + `/socket.io`. Point another Traefik host at
it (e.g. `Host(\`dev.openquester.app\`)`) to use the app there. The Docker build
takes `VITE_DISCORD_CLIENT_ID`from the repo variable`WEB_DISCORD_CLIENT_ID`.

`.github/workflows/web.yml` builds, runs unit and e2e tests, then deploys
`dist/` with `functions/` to the Cloudflare Pages project `openquester-web`.
Previews proxy to `https://dev-api.openquester.app`, production (`main`) to
`https://api.openquester.app` (`wrangler.toml`). Because of the proxy the app
and the session cookie share one origin, so no CORS or third-party cookies.
Set `VITE_API_URL` only to talk to an API on another origin directly.
`VITE_DISCORD_CLIENT_ID` enables Discord sign-in. CI takes it from the repo variable
`WEB_DISCORD_CLIENT_ID`, else `DISCORD_AUTH_CLIENT_ID` in the Flutter `ENV_FILE_CONTENT`. Its redirect URL
`<origin>/auth/discord` must be registered in the Discord app.

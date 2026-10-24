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
npm run test:browser # native Chromium storage tests; installs via npx playwright install chromium
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
src/features/   screens: auth, home, packages, upload (.siq/.oq import), editor, create-game, settings, stats, game (lobby + play)
src/ui/         small design-system components
src/theme/      token sets ([data-theme] blocks) and the theme registry
src/i18n/       en / uk / ru resources
e2e/            Playwright specs, seed + helpers, local backend stack
browser-tests/  native browser API regressions, no backend or Docker
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
  Import compatibility warnings stay on the draft and appear in the publish
  check. Hiding the editor report only hides that panel; it keeps the warnings.
  Draft references and available media commit in one IndexedDB transaction.
  Collection reads references and deletes unused media in the same transaction
  scope, so other tabs cannot collect a save's files between writes. Autosave
  supplies all available referenced media, including files restored by undo.
  Drag and drop is native HTML5; every drag has a Move dialog equivalent for
  touch and keyboard.
  `/packages/$id/preview` opens a published package in the same editor with
  `readOnly` set: no drag, menus, autosave or publish.
  A published package opens as a draft (`fromServer.ts`) whose media keeps
  its storage `url` instead of bytes; Publish then saves over it with
  `PUT /v1/packages/{id}` (author or `edit_package`) and skips files already
  stored.
- Media is re-encoded in the browser before upload and publish
  (`features/upload/optimize/`, on by default, `compressMedia` setting):
  pictures to AVIF (libavif WebAssembly in a worker, WebP fallback), video to
  VP9 + Opus in WebM (AV1 is smaller but most iPads can't decode it; Apple
  plays VP9 only in WebM), and sound to AAC (Opus fallback) in fast-start MP4
  because iPhone and iPad play audio-only WebM Opus as silence. WebCodecs and
  mediabunny do the work, with the Flutter encoder's limits (1280×720, 20 fps).
  The encoders are a lazy chunk, so only uploaders download them. A file the
  browser can't decode or encode, or that doesn't shrink by 5 %, is uploaded
  as it was. The server's CSP allows `'wasm-unsafe-eval'` for the encoder.
- Storage limits (`docs/specs/storage-limits.md`): uploads send `fileSizes`
  so the server can refuse with a 413 that names the limit; the upload and
  publish screens show that message as is. `features/storage/` holds the
  usage bar (`GET /v1/me/storage`) and the admin Storage tab.
- Upload state (`docs/specs/package-upload-state.md`): a package whose media
  isn't all in storage is `uploading` and can't be hosted. The upload screens
  show a row per file (`UploadProgressCard`), keep unsent files in IndexedDB
  (`upload/stash.ts`) and ask `GET /v1/packages/{id}/upload` afterwards;
  `/packages/$packageId/upload` finishes an interrupted upload from that
  stash or from the same file picked again. Uploads send `sourceHash` and the
  review warns when the same file is already on the server.
- Question media: players ACK `media-downloaded` only once every file is
  loaded (images decoded), so the question timer starts when everyone can see
  it. Failed loads, decoding errors, and local preload timeouts never send a
  readiness ACK; the server's media timeout handles unavailable media.
  Audio and video have no controls and play in the `showing` phase (or while
  answering a final question), stopping while the game is paused;
  blocked autoplay falls back to muted playback plus an "enable sound" button.
  Question and answer content plays one step at a time (`ContentStage`) on the
  server's `contentPlan`; the position is the phase timer's elapsed time
  (`game/contentPlan.ts`, `session.content` in the reducer), frozen while
  someone answers. Players report real audio/video lengths with the ACK.
  `question-data` re-sent after a rejoin keeps the snapshot's clock: mid-answer
  the timeline stays frozen instead of replaying from the answer timer. Audio
  and video that played to the end offer "Play again", on that device only.
- Showman actions (rulings, score fixes, kicks, pauses, skips, early buzzer...)
  are logged to the game chat by the server (`ShowmanActionLogLogic`, run from
  `SocketActionHooks`): a chat line with `system: { action, params }` that the
  chat shows translated (`chat.log.*`), with an English `message` for other
  clients. System lines have no message bubble and do not increase the unread
  chat badge. The showman also has ×2 and 0 rulings next to right/wrong, and
  "Skip round" asks for confirmation.
- One socket per account: joining from another tab or device makes the server
  drop the older socket ("io server disconnect"). That page shows "Opened
  somewhere else" and does not reconnect by itself, which would otherwise take
  the seat back and loop; "Play here" reconnects it.
- The game list counts only players with `status: "in-game"`; a leaver keeps
  their seat for a rejoin but the place shows as free, and players may join a
  game in progress (the server refuses only in the final round).
- In-game chat, players and showman tools are side panels at `lg` (1024 px)
  and up, never modals over the game; pins are per device in settings
  (`pins`). Below `lg` they open as sheets. `3xl`/`4xl` breakpoints scale the
  board and question for 1920 px+ and 2400 px+ monitors.
- The admin panel (`features/admin/`) shows each tab only when the account
  holds its permission; staff roles and game moderation are described in
  `docs/specs/admin-moderation.md`. A `game-closed` event sends everyone home.
- `features/stats/` holds the leaderboard page (`/leaderboard`), the profile
  stats card on Settings, the "Report question" dialog shown under the answer
  reveal, and the reports list on My packages (author or `edit_package` only).
  Totals come from saved `player_game_stats`, so only finished games count.
- Layouts must work at 375 px wide with no horizontal scroll; the e2e
  `expectNoHorizontalScroll` check runs on phone, tablet and desktop.

## Deploy

The server's Docker image (`docker/Dockerfile`) also builds `web/` and serves it
for every non-API path (`WebAppController`, `WEB_APP_DIR`), so one container on one
port answers both the app and `/v1` + `/socket.io`. Point another Traefik host at
it (e.g. `Host(\`dev.openquester.app\`)`) to use the app there.

`.github/workflows/web.yml` builds, runs unit and e2e tests, then deploys
`dist/` with `functions/` to the Cloudflare Pages project `openquester-web`.
Previews proxy to `https://dev-api.openquester.app`, production (`main`) to
`https://api.openquester.app` (`wrangler.toml`). Because of the proxy the app
and the session cookie share one origin, so no CORS or third-party cookies.
The Pages proxy rejects any supplied `Origin` that differs from its request URL
before forwarding cookies; matching preview origins and originless native
requests remain supported.
Set `VITE_API_URL` only to talk to an API on another origin directly.
Sign-in providers are configured on the server, not in the build: the app reads
`GET /v1/auth/settings` (`oauthProviders`, a list of `{ provider, clientId }`)
and shows Discord sign-in when the server's `DISCORD_CLIENT_ID` is set. A new
provider is added to `EOauthProvider`, given its own env var and listed in
`AuthRestApiController.getSettings`; clients skip providers they don't know. Its redirect URL `<origin>/auth/discord` must be
registered in the Discord app.

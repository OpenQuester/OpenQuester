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
npm run test:browser # native Chromium storage/media tests; installs via npx playwright install chromium
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
src/features/   screens: auth, home, packages, upload (.siq/.oq import), package-editor, create-game, settings, stats, game (lobby + play)
src/ui/         small design-system components
src/theme/      token sets ([data-theme] blocks) and the theme registry
src/i18n/       en / uk / ru resources
e2e/            Playwright specs, seed + helpers, local backend stack
browser-tests/  native browser API regressions, no backend or Docker
functions/      Cloudflare Pages Functions proxying /v1 and /socket.io to the API
```

## Rules

- Keep component lifetimes, rendered markup and styles stable when extracting
  views or hooks. Verify the affected flow with the permanent tests and browser
  checks. Store one-off audit scripts, screenshots and logs outside the repository;
  permanent tests must run without a developer's private snapshot directory.
  An audit of the media editor does not cover the rest of the client.
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
- Name files and exports by their actual responsibility: `PackageEditorPage`
  edits a package, `MediaEditor` owns an attachment session, and
  `AudioVideoEditor` handles audio/video tools. Use the same name for a primary
  component or hook and its file. Prefer explicit domain types (`DraftQuestion`,
  `PackageValidationReport`, `ImageAnnotation`) over generic `Model`/`Data` types.
  Keep conventional primitives, format names (`siq`, `oq`) and public protocol
  names; prefixes alone do not make a name clearer.
- Reuse `ui/Page` for page structure and route feedback (`PageMessage`,
  `PageLoading`). Shared layout, heading, dialog and link recipes live in
  `ui/layoutStyles`, `typographyStyles`, `dialogStyles` and `linkStyles`.
  Larger feature layouts and controls use nearby, responsibility-named
  `*Styles.ts` modules, composed from shared recipes when their roles match.
  Avoid copying long utility strings between views or adding wrappers just to
  hide them. Short local utilities and UI primitive definitions can stay inline.
  Runtime coordinates, progress, crop bounds and canvas dimensions remain
  computed `style` values; extracting these must not change geometry or markup.
- `app/AppShell` keeps auth/path subscriptions and composes `AppHeader`; its
  account link preserves loading, visitor and signed-in states. Route declarations,
  search validation and lazy boundaries stay in `app/router`; `NotFoundPage` is a
  separate view. Shared page width/spacing and headings belong in `ui/Page`, so
  feature pages do not import the app shell just for layout.
  `ui/Menu` renders the trigger and portal; `useMenu` owns positioning, focus and
  dismiss listeners. Keep its item-count dependency, Escape focus return and
  listener cleanup on close/unmount. Existing small UI primitives, theme tokens
  and shared browser hooks remain cohesive modules; do not split by line count.
- Home (`features/home/`) composes join/host, rejoin and open-game views;
  `useHomePage` owns search, filters and hidden rejoin state. Keep rejoin
  independent of list filters and preserve the distinction between a retained
  seat and the connected-player count.
  Create-game keeps form state and request completion in `useCreateGame`;
  setup fields, package preview and timers are presentation components.
  Preserve password drafts when privacy changes and native timer disclosure
  state across form/query updates. Defaults and timer choices live in
  `create-game/gameSettings.ts`; shared radio controls use `ui/RadioButton`.
- The package editor (`features/package-editor/`) edits an id-keyed tree (`packageDraft.ts`)
  through pure functions in `packageOperations.ts`; the store keeps undo history and one
  store per open editor. Drafts and media live in IndexedDB (`draftStorage.ts`)
  until Publish, which reuses the upload flow. `validatePackage.ts` follows
  `docs/specs/package-validation-spec.md`: critical issues block Publish.
  Import compatibility warnings stay on the draft and appear in the publish
  check. Hiding the editor report only hides that panel; it keeps the warnings.
  Draft references and available media commit in one IndexedDB transaction.
  Collection reads references and deletes unused media in the same transaction
  scope, so other tabs cannot collect a save's files between writes. Autosave
  supplies all available referenced media, including files restored by undo.
  Media editing (`features/package-editor/media-editor/`) stays inside its owning form:
  Save media stages a replacement; Save question/details commits the tree and
  files together. Import queues hold later File references until needed.
  Draft saves collect unreferenced media atomically; session undo retains the
  old bytes only in memory. Accepted media carries local `preserveEncoding`
  metadata so publishing cannot re-encode the reviewed result. This flag is
  never part of the HTTP or archive contract. See `docs/specs/media-editor.md`.
  Cropping keeps annotations in source coordinates and invalidates picture-point
  targets like rotation. Preview zoom does not change exported pixels.
  Image tools use shortcuts 1–7 and return to Select/move after placement.
  `media-editor/ImageEditor.tsx` and `AudioVideoEditor.tsx` compose their feature-local
  view components with only their own values and actions, not the whole edit session.
  `image-editor/` separates canvas/preview resources from the
  edit session; `audio-video-editor/` separates source decoding and playback from edit
  history. `useMediaSession.ts` owns one queue item's acquisition, processing,
  cancellation and shortcuts; `useStagedMedia.tsx` owns the form's queue and
  pending files. Shared controls and types stay in `media-editor/`.
  `QuestionDialog.tsx` chooses read-only or editable presentation. Its keyed
  `question-form/QuestionForm.tsx` composes the fields and keeps one responsive
  settings panel in a CSS grid; resizing must not remount its fields.
  `useQuestionForm.ts` owns staging/save/discard;
  `useQuestionMedia.ts` applies changes to one attachment occurrence using the
  latest list. `questionUpdates.ts` holds pure type/choice transformations.
  Keep temporary text input state in field components so incomplete decimals,
  empty lines and cursor position survive normal parent renders.
  `PackageEditorShell.tsx` composes the creator workspace from `shell/` views;
  `usePackageEditorShell.ts` owns navigation, package actions and dialog state. Reuse
  `PackageEditorControls` for shell icon buttons and the preview's density toggle.
  `package-details/` separates staged metadata/logo state from its form, using
  `FieldGroup` for repeated label/control/help layouts. `usePackageEditorDraft.ts`
  owns route-specific loading/retry, autosave, late-load guards and URL cleanup.
  `packageEditorStore.ts` owns store-dependent media context/selectors;
  `packageMedia.ts` contains media transformations without importing the store.
  Preserve form mount boundaries, current-store reads in successive actions,
  text-input/dialog shortcut exclusions, and the final save on teardown.
  `board/` and `outline/` separate item views from insertion, drag/drop and hover
  hooks. Keep the existing board versus outline price-movement policies.
  `tools/` owns the prices, paste, search and move forms; closing a dialog must
  preserve its prior input/mount semantics. `AttachmentPreview` is shared by attachment
  fields and read-only previews; `questionPresentation.ts` holds type summaries.
  `home/` separates draft-list/actions views from `useDraftLibrary`; shared
  draft creation/import lives in `createDraft.ts`, not the route component.
  `publish/` separates check/progress/result views from `usePublishPackage`.
  Keep the publish step in the owning dialog, reject close while uploading,
  retain error/retry and replacement semantics, and treat unknown server
  completion as resumable. `MediaCompressionToggle` is shared with upload/resume without
  importing the upload page. Editor/preview headers reuse `shell/packageEditorShellStyles.ts`.
  Arbitrary rotation uses the same crop transform for rendering and pointer mapping.
  AV fields
  use minutes:seconds; fades share the full selected duration without overlap.
  AV seeking uses one interactive waveform/thumbnail timeline. Cut-left/right
  actions set boundaries at its playhead and reject empty intervals. Play/Pause
  resumes inside the selection and restarts at its beginning otherwise.
  PointPicker's wrapper shrinks to the displayed image; target markers use a
  square aspect ratio so width-based radius stays circular in flex layouts.
  Drag and drop is native HTML5; every drag has a Move dialog equivalent for
  touch and keyboard.
  `/packages/$id/preview` opens a published package in the same editor with
  `readOnly` set: no drag, menus, autosave or publish.
  A published package opens as a draft (`loadPublishedPackage.ts`) whose media keeps
  its storage `url` instead of bytes; Publish then saves over it with
  `PUT /v1/packages/{id}` (author or `edit_package`) and skips files already
  stored.
- Package browsing (`features/packages/`) separates the route, search controls,
  tiles, detail view and author rows. `usePackageBrowser` owns debounced search,
  filters, paging and URL selection. Both catalogues share `PackageListHeader`,
  `ui/Pagination` and `PackageDeleteButtons`; confirmation and mutation
  errors stay with each owning row/panel. `packageSummary.ts` contains pure
  counts used by details and game creation; queries remain in `usePackages.ts`.
  `stats/PackageReports` retains query/mutation/dialog ownership while
  `PackageReportItem` renders each report. Keep pending actions disabled until
  the existing mutation completes and let query invalidation refresh counts.
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
  `UploadPackagePage` and `ResumeUploadPage` compose their access, review,
  pending and result views. `usePackageUpload` and `useResumeUpload` own their
  asynchronous transitions, query invalidation and retry policies. Keep the
  server's confirmed `ready` status authoritative and preserve the original
  source identity when resuming. `PackageImportDropZone`, `UploadPageLayout`, result links
  and the upload warning hook are shared by both routes. `UploadFileList`,
  `UploadProgressBar` and pure `progress.ts` calculations also serve publishing;
  progress updates must preserve the file list's expanded state. Keep query
  and form mount boundaries stable when moving these views.
- Question media: players ACK `media-downloaded` only once every file is
  loaded (images decoded), so the question timer starts when everyone can see
  it. Failed loads, decoding errors, and local preload timeouts never send a
  readiness ACK; the server's media timeout handles unavailable media.
  Replacing a question, leaving the media phase, disconnecting or closing the
  connection cancels preload resources. Deferred seek/autoplay callbacks must
  stop on pause, source change or unmount.
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
  `play/media/` separates `QuestionMediaItem` loading/failure presentation,
  `QuestionMediaPlayback` controls, `useQuestionMediaPlayback` element effects and `useContentPosition` timeline
  scheduling. Preserve media keys, the latest clock read on resume, autoplay
  fallback and the timeline timer's cleanup. `QuestionMedia` only orders files;
  `ContentStage` composes screen steps, background sound and the final recap.
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
  `play/GameScreen.tsx` composes `screen/GameHeader` and `screen/GamePanels`.
  `screen/useGameScreen` owns panel visibility, device pins, unread message IDs,
  focused-player tools and screen shortcuts. Preserve the current wide/sheet
  mount boundaries and keep the report dialog outside the changing stage.
  `play/GameActionDock.tsx` renders the phase, action and next step. `dock/` separates its
  presentation hook, pure role/phase models and answer/bid controls. Models return
  typed action data; `DockAction` owns markup and connection dispatch. `useTimedAnswer`
  retains the deadline, one automatic attempt and pending/accepted guards for
  final/all-play answers. A rejected/timed-out send remains manually retryable.
  Models use the existing selectors without JSX or connection callbacks; they do not mutate scores.
  Keep hook calls unconditional and form identity stable across timer, pause and
  reconnect updates; reset drafts on a different question/answerer. Paused/offline
  forms stay mounted but hidden and disabled; choices and point picks also gate sends.
  `play/QuestionStage.tsx` composes `question/` views for choices, point answers,
  waiting cues, the reveal and the private showman panel. `useQuestionStage`
  derives the visible state; `useAnswerChoices` owns the reveal timer and selected
  option within the existing question/answerer key. Keep media readiness gating,
  private answers, failed-send retry and question-key resets intact. Shared
  question typography/width lives in `question/questionStyles.ts`; content playback still
  belongs to `ContentStage` and `QuestionMedia`.
  Final/all-play stages keep their own score rules and review events while
  sharing `stages/AnswerReview` presentation and `stages/stageStyles.ts`. Review rows
  retain answer/player keys and showman-only controls. Secret price presentation
  is separate from recipient selection; `useSecretTarget` is scoped to the game,
  user, round and secret question. Validate the selected recipient against current players.
  `play/board/` separates width measurement from theme/cell presentation; keep
  the same uneven-row padding, narrow-screen wrapping and observer cleanup.
  `play/chat/` owns the message draft/scroll hook, message view and translated
  showman log. `play/players/` holds score chips, phase labels, player rows and
  the inline administration form. Keep player IDs as list keys and retain the
  administration key `${player.meta.id}:${player.score}`: server score changes reset that
  draft, while turn/restriction changes preserve it. These views emit existing
  commands; only server events update actual scores or restrictions.
  `play/host/` separates host-control presentation from phase/store derivation;
  keep the player-management key and conditional next-round dialog lifetime.
  `play/menu/` holds shortcut and preference views; settings subscriptions stay
  in `GameMenu`. `ui/Toggle` is shared with settings and package compression,
  so these controls do not import the settings route component.
- Game entry (`features/game/`) separates route join/rejoin decisions in
  `useGameEntry`, connection ownership in `connection/useGameConnection`, and
  form state in `join/useJoinForm`. `GamePage` keeps the join form visible with
  busy submit buttons until acceptance; rejected passwords can be corrected inline.
  `ConnectedGame` keeps the round interlude mounted across lobby and play.
  Keep the connection keyed by game and account ID and
  create it once per mount; cleanup closes it without leaving its seat. A failed
  join retry disables automatic rejoin. Ignore leave events for another game.
  Keep join drafts in `JoinPanel` even when its form is temporarily hidden.
  `lobby/` separates header, seats, role actions and invite views from `useLobby`;
  `getLobbySeats` preserves missing-slot fallback and the two-empty-seat limit.
  Shared lobby panel/control classes live in `lobby/lobbyStyles.ts`. Role actions
  still wait for server events; only connected players count toward readiness.
- The admin panel (`features/admin/`) shows each tab only when the account
  holds its permission; staff roles and game moderation are described in
  `docs/specs/admin-moderation.md`. A `game-closed` event sends everyone home.
  `AdminPage` composes the overview, users, games, packages, storage and system
  views. List hooks own debounce/paging; row keys retain confirmations and
  staff drafts across query refreshes. `users/` separates role selection from
  permission requests, and `storage/` keeps raw limit inputs local to their
  keyed forms. Preserve retry values and group-default/null quota semantics.
  Queries, polling and invalidation remain in `useAdmin` and `useStorage`.
  Lists share `ui/Pagination` with package catalogues and `admin/adminStyles.ts`
  for repeated row/list classes.
- `features/stats/` holds the leaderboard page (`/leaderboard`), the profile
  stats card on Settings, the "Report question" dialog shown under the answer
  reveal, and the reports list on My packages (author or `edit_package` only).
  Totals come from saved `player_game_stats`, so only finished games count.
  `LeaderboardTable` is presentation; period/query ownership stays in the page.
  `questionReportStore` outlives the reveal; open/sent state and form keys include
  game, account and question. A late report response must not close a newer dialog.
  Creating a report invalidates its package report list; read/save failures stay visible.
- Profile state lives in `settings/useProfileSettings`, called by the existing
  conditionally mounted `SettingsForm`. `ProfileCard` and `SettingsPreferences` compose
  its views; query refresh must not reset a typed name. Authentication routes
  delegate guest submission to `useLoginForm` and OAuth completion to
  `useDiscordCallback`; preserve the once-per-mount exchange guard, auth
  invalidation and redirect ordering. Avatar processing, auth queries and
  settings persistence remain in their existing data modules. Account changes cancel
  in-flight reads and remove cached account data, retaining the exact `me` query.
  Persisted settings are untrusted input; null/corrupt values must preserve startup.
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
`functions/v1/[[path]].ts` and `functions/socket.io/[[path]].ts` are Cloudflare
Pages catch-all routes, not generated placeholders. The double brackets match
nested URL paths; keep these filenames so deployed API and socket requests reach
the shared proxy. See the [Pages routing documentation](https://developers.cloudflare.com/pages/functions/routing/).
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

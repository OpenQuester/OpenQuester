# React client audit

Status: audit and React fixes complete; remaining integration/dependency limitations are documented below.
Audit date: 2026-10-24. Scope: the React client in `web/` and its related documentation.

## Follow-up after merging main (2026-10-24)

PR #446 was squash-merged into `main` at `ecd145c8e`. Its complete tree is
identical to the former PR base `b87d8f45f`; this was verified before resolving
all 91 add/add and documentation conflicts. Merge commit `be8d3071e` preserves
the reviewed `8a95542ca` tree exactly and includes current `main` as a parent.

The repeat review checked account/query identity, draft and pending-answer
lifetimes, modal/hotkey behavior, staged media, resource cleanup and the PR's
review feedback. It confirmed one new issue: audio/video in the question form
continued playing while the media editor hid that form. The owning form now
pauses its attachment and question-preview elements on entry, preserving their
DOM and the unsaved question. Returning leaves playback paused.

A new native Chromium regression starts both audio and video, opens media editing,
checks that the original elements pause while the editor can play its own preview,
and confirms the same form elements and unsaved text survive Cancel. The test
failed on the old implementation and passed after the fix.

Fresh checks: 309 unit tests, 22 native browser tests, production build/typecheck,
lint, formatting and API-type verification passed. React Doctor 0.9.18 still
reports 0 errors / 62 warnings / score 74 with no new rule/file diagnostics.
Full E2E: **123 passed, 1 failed, 14 existing skips** in 13.7 minutes. The only
failure is the existing full-game `Ready to buzz` → `Answering` timeout (B1);
there were no new failure signatures. The test API, previews and isolated
`oq-web-e2e` containers were stopped; their ports have no listeners.
Evidence: `C:/Users/diazo/AppData/Local/Temp/oq-pr476-sync-20261024-220725`.

## Baseline and evidence

Work started on `claude/project-thread-0sywi1` at
`b87d8f45f62c81350876000537b58294a0123d21`, with **319 existing dirty status entries**.
Those changes were preserved. The audit itself made no commits, push, PR,
reset, stash or checkout; publication was authorized afterward.
Backend, Flutter and public API contracts were not changed.

Evidence directory on this machine:
`C:/Users/diazo/AppData/Local/Temp/oq-react-audit-20261024-151155`.
It contains the initial status and patches, a complete pre-edit `src` snapshot,
the previous audit report, scanner JSON, test logs, traces, screenshots and
instrumented WebSocket/Redis captures. Diagnostics stay outside tracked source.

The October 23 audit's R1–R13 fixes were already present at this baseline:
responsive editor identity, documentation routing, dock descriptors, narrow media
views, unused exports/import cycles, exact quota conversion, storage/upload error
recovery, media cleanup, menu/admin keyboard behavior, feedback timers and the
375px lobby. They are retained; they are not counted as newly implemented below.

## Coverage

| Area                            | Reviewed behavior and evidence                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App/auth/home/create/settings   | Query ownership, identity transitions, routes, errors, persisted settings; unit tests and browser routes                                                 |
| Game entry/lobby/play/results   | Role/phase selectors, reconnect/takeover, drafts, pending/rejected commands, keyboard, media lifecycle; unit and real-backend E2E                        |
| Editor/media/import/export      | Form identity, fractional input, staged media, history, point geometry, SIQ/OQ conversion, animation preservation; unit and native codec/IndexedDB tests |
| Upload/packages/storage         | Immediate busy state, compression, resumable upload, errors, quotas, cache freshness; unit and backend-backed creator flows                              |
| Admin/stats/shared UI           | Mutation recovery, reports, pagination, dialogs, radio/tab navigation, account scoping; component and browser coverage                                   |
| Styles/localization/performance | Three widths, two themes, three languages; screenshots, overflow/page-error checks, measured media-header work                                           |
| Source/config/dependencies/docs | Runtime import graph, unreferenced files/exports, generated entrypoints, installed APIs, dependency audit, architecture/spec routing                     |

Ponytail, improve-react, React Doctor, React best practices/composition,
Web Interface Guidelines and the editor/assurance/docs workflows informed the
review. The user explicitly authorized implementation after the audit; fixes
were selected from behavior and measurements, not scanner score alone.

## Confirmed findings fixed in this audit

| ID  | Problem and resulting behavior                                                                                                                                                                                                                     | Regression evidence                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| F1  | Pause/disconnect unmounted answer and bid forms, losing drafts. Forms retain their question/answerer identity while hidden and disabled; a new question/account resets them.                                                                       | `GameActionDock.test.tsx`, real rejoin/pause E2E                |
| F2  | Rejected text/point/final submissions could remain locally locked; timed answers could repeatedly retry automatically. Server acceptance and pending state now control submission, drafts survive rejection, and manual retry remains available.   | Dock, timed-answer and stage tests                              |
| F3  | Space intercepted focused controls, key repeats and modal interaction. Hotkeys respect native controls, composition, repeat events and modal dialogs.                                                                                              | Stage tests; focused Game menu E2E                              |
| F4  | Another-tab takeover did not use browser modal focus/inertness. A native modal requires an explicit takeover/home choice and blocks Escape dismissal.                                                                                              | Three-device takeover E2E, native focus probe                   |
| F5  | Failed game previews had no recovery; answer choices could submit while paused/offline; stale secret targets could survive question/seat changes. Preview retry, submission guards and scoped eligible target selection fix these cases.           | Game/dock/stage tests                                           |
| F6  | Upload stayed idle during the first lazy import, allowing competing actions and misleading 0/0 progress. Busy state starts synchronously and optimization starts at 0%.                                                                            | `UploadCompletion.test.tsx`, `uploadViews.test.tsx`             |
| F7  | Optimization could flatten animated PNG/WebP/AVIF. Shared byte detection preserves animation; ordinary JPEG/AVIF checks avoid decoding the entire file and preview detection is memoized.                                                          | Animation byte tests; native media suite; benchmark below       |
| F8  | Resume network failures could leave indefinite loading. All query failures produce recovery UI with retry.                                                                                                                                         | `ResumeUploadPage.test.tsx`, resume E2E                         |
| F9  | Fractional duration input lost incomplete decimal text, and deleting a point question's first image retained stale target geometry. Local decimal/comma drafts and target cleanup preserve valid editing behavior.                                 | `QuestionDialog.test.tsx`, native Save/Undo/focus tests         |
| F10 | SIQ non-final rounds marked as final lost extra questions before conversion. Normalize round type before parsing, preserve converted questions, and warn about conversion or extra questions in a valid final.                                     | `parse.test.ts`; EN/UK/RU warning strings                       |
| F11 | Account changes retained private query data, settings drafts and game connections. Identity transitions cancel/remove account queries and remount identity-owned forms/connections. A first anonymous lookup preserves concurrent public requests. | `useMe.test.tsx`, cold-cache resume E2E                         |
| F12 | Question reports leaked across games/accounts; an old completion could close a new report; package reports stayed stale. Scope report state and completion, and invalidate the affected package's reports.                                         | `reports.test.tsx`                                              |
| F13 | Report reads/resolutions and quota updates failed without usable feedback. Show errors, retain drafts and allow retry; a zero-byte quota displays as full.                                                                                         | Reports/admin/storage tests and E2E                             |
| F14 | Pagination disappeared after a result set shrank, stranding the current page. Keep recovery navigation and clamp Previous to a valid page.                                                                                                         | `controls.test.tsx`                                             |
| F15 | Dialog close lost opener focus; radio choices/tabs lacked expected keyboard navigation; malformed saved settings could break startup. Restore focus, use roving Arrow/Home/End navigation, and validate persisted settings.                        | Shared controls tests; new native settings tests                |
| F16 | ZIP processing used vulnerable fflate 0.8.2. Upgrade to 0.8.3; update the independently permitted jsdom undici dependency from 8.11.2 to 8.12.3.                                                                                                   | Unit/import/browser suites; runtime npm audit has zero findings |

Related rules are recorded in `web/AGENTS.md`, `docs/specs/game-state-matrix.md`,
`docs/specs/media-editor.md` and `docs/specs/siq-compatibility-matrix.md`.
The SIQ document distinguishes React's conversion from unchanged Flutter behavior.

## Performance and scanner decisions

- On repeated 20 MiB inputs, the previous image detector's median was approximately
  4.3 ms for JPEG and 4.5 ms for AVIF. Header-only/early-return handling reduced
  these helper calls below 0.002 ms. PNG/WebP still inspect animation metadata;
  memoization avoids repeating that work for preview adjustments. This is a
  local helper benchmark, not a browser frame-rate claim.
- React Doctor **0.9.18**, schema 3, full unchanged selection: initial **456 files,
  0 errors / 64 warnings / score 74**; final **461 files, 0 errors / 62 warnings /
  score 74**. Coverage is complete; no checks were skipped or suppressed. The
  separate changed-files regression scan is not used as a comparable full score.
- Reviewed residual warnings include cohesive phase/parser module complexity,
  stable/index-keyed attachment rows whose identity preserves focus, intentional
  sequential media work, bounded collections, guarded asynchronous work and
  externally owned object-URL cleanup. Native editor focus verification ruled
  out changing attachment keys to hashes. No mechanical module split was added.
- The delete-game loading warning is a false positive: failure resets the flag
  inside `catch`; success exits the game. Required modal autofocus is intentional.
  Media caption warnings remain a content/contract limitation: the package format
  provides no caption track to render. No empty/fake caption track was inserted.
- Runtime import inventory found no cycles or unreferenced source files. Generated
  schema exports, Cloudflare entrypoints and config-discovered test setup remain.
- The existing lazy media codec chunk is about **693 kB** and still triggers the
  build size advisory. It is loaded for media work; no claim of reduced bundle size.

## Original audit verification

| Check                                    | Result on the updated working tree                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/component                           | **309 passed / 51 files**, `npm test -- --maxWorkers=2` (baseline: 280 / 48)                                                                                  |
| Typecheck, lint, API type drift          | Passed: `npm run typecheck`, `npm run lint`, `npm run check:api`                                                                                              |
| Production build                         | Passed; final preview serves the isolated `final-dist` artifact                                                                                               |
| Formatting and whitespace                | Passed; final report formatting rechecked before handoff                                                                                                      |
| Native Chromium media/IndexedDB/settings | **21 passed**; codecs, staged edits, history, storage, responsive focus and corrupt persistence                                                               |
| Public browser matrix                    | **90 passed**: 5 routes × 1440/800/375px × Midnight/Daylight × EN/UK/RU; no horizontal overflow or uncaught page errors; representative screenshots inspected |
| Full real-backend Chromium E2E           | **122 passed, 2 failed, 14 existing skips** across desktop/tablet/phone (15.8 minutes); failures explained below                                              |
| Dependencies                             | `npm audit --omit=dev`: **0 vulnerabilities**; remaining development chain described below                                                                    |

Final evidence: `final-unit-verified.log`, `final-lint.log`, `final-build.log`,
`browser-final-fixed.log`, `visual-qa.json`, `e2e-verified.json`,
`doctor-initial.json`, `doctor-final.json`, `npm-audit-final.json`.
The two final E2E failures are the full-game buzzer transition (B1) and a tablet
scenario whose initial JavaScript request failed with `ERR_NO_BUFFER_SPACE` before
login. The unchanged scenario passed its isolated tablet recheck (1/1, 20.9 s;
`e2e-transport-recheck.json`). No new skips were added.
The first integration run exposed and helped fix cold-auth cache cancellation;
the final run uses `localhost`, matching the test API's cookie domain.

## B1 — Server buzzer transition remains intermittent

Fresh instrumented reproduction on October 24 captured game **UJ3F** with four
real browser roles. Alice sent `question-answer`; Redis stored
`buzzerWindow.presses: [311]`. More than four seconds later the server still had
`questionState: showing`, no answering player, and the unresolved window. Both
observed clients remained connected and neither received the answer transition.
The configured acceptance window is **300 ms**.

Evidence: `buzzer-multiplayer-failure.json` contains timestamped WebSocket frames,
Redis state and client stores. One preceding four-role attempt passed; twelve
simpler attempts passed. The failure is intermittent and lies after command
receipt at the server boundary. The exact timer/queue cause is not established.
Inspect `QuestionAnswerUseCase._pressInWindow`, `TimerExpirationUseCase` and
`TimerExpirationService._resolveBuzzerWindow` in a backend follow-up. No client
workaround, server change, weakened answer assertion or new test skip was added.

## B2 — Development dependency and environment limits

The complete npm audit retains **3 development dependency entries** (2 moderate,
1 high) through Wrangler/Miniflare's exact `undici@7.29.1` pin. The available newer
Wrangler/Miniflare version checked during this audit still has that pin. No forced
override or out-of-range downgrade was applied. This is separate from the clean
production dependency audit. The fflate fix is documented in its
[0.8.3 release](https://github.com/101arrowz/fflate/releases/tag/v0.8.3).

The installed Node **24.14.0** is below jsdom's declared Node 24 minimum **24.15.0**;
checks above passed on the actual runtime, but the engine warning remains.
Verification covers Chromium, not Firefox/Safari, live Discord OAuth, deployed
Cloudflare behavior, load testing or release certification. Backend build passed
to launch testing; backend Jest/Flutter checks were not run because those sources
and contracts were unchanged.

Cleanup verified: both Vite previews and the test API are stopped; the isolated
`oq-web-e2e` containers, volumes and network were removed. No listeners remain on
ports 4173/4174/4175/53000/55432/56379/58333. Other Docker projects and WSL were left running.

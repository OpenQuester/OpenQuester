# Web editor UX and question playtest — approved implementation plan

Status: implemented and independently reviewed; the final-head CI gate remains in progress on the draft PR.
Owner/reviewer: originating chat `01a17dd2-f558-7f60-9e97-85f816942ca3` (Improve package editor UX).

## Scope and approved decisions

Implement all 18 items below in one PR. React/web is the target. The three approved backend exceptions are correcting point-answer circle evaluation (including additive contract changes), repairing the existing multi-player wrong/skip transition for choice and hidden questions, and retaining the point reveal image on reconnect. Do not modify Flutter or generated Dart files.

The user explicitly approved:

- A local interactive game simulator, without real rooms, package publication, or real player sessions.
- Moving the comment before the question in the editor and visibly showing it to the showman before answers; removing it from the public answer reveal.
- Fixing server point checking to match the client's circle.
- Slider 100% means a circle DIAMETER of 120% of the image's larger dimension, not a radius of that size.
- Upgrading old point metadata when publishing through web. Existing published packages without metadata retain legacy checking; no server backfill.
- Separate execution chats with GPT-6.1 Terra, Extra High (`gpt-6.1-terra`, `xhigh`), goals, a planning phase, automated/manual/visual testing, and a single big PR. A draft PR may be created after the first meaningful commit.
- The originating chat acts as orchestrator and reviewer, prioritizing readability, patterns, and project style while reviewing the entire change. Corrections go back to the SAME implementation chat.
- Additional user-approved backend exception: fix the existing multi-player wrong/skip transition for choice and hidden-price questions, including restoration of the saved showing timer. Keep single-answerer rules unchanged and cover the real Socket.IO flow.

## Execution workflow

1. Read root/scoped AGENTS and applicable skills. Ponytail full stays active. Use package-editor-change, relevant React guidance, react-doctor, and the applicable backend/API/test skills when those boundaries are touched. Preserve small comprehensible components, cohesive hooks/helpers, explicit domain types, existing theme tokens and localization patterns.
2. Create a goal for the full assigned objective, with no invented token budget. Keep it active until the actual acceptance criteria are complete; a planning checkpoint or first implementation is not completion.
3. Do not edit the dirty original checkout except for this handoff file. Create an isolated managed worktree from freshly fetched `origin/main`, on `codex/web-editor-ux-playtest`. Copy this plan into the worktree, and use that worktree explicitly for every command. Do not reset, stash, clean, switch, or commit unrelated original-checkout work.
4. PLAN FIRST: inspect current main (the planning inspection used another checkout), map every item to actual owners and tests, document commit stages, simulator state/command boundaries, geometry compatibility, and evidence paths. Send a planning checkpoint to the orchestrator and request its review before feature edits. The human has authorized ongoing coordination between these chats. If actual system Plan mode is active, obey it; a prompt cannot change that mode. Otherwise perform a read-only planning phase and then continue after the orchestrator's checkpoint response.
5. Implement in cohesive stages: shared UI/media, form/navigation/storage, geometry/contracts, simulator, complete verification. Commit only scoped work, with short result-oriented messages. Create one draft PR after the first meaningful verified commit if useful, always attach its URL to the chat, and push subsequent commits to it.
6. Report checkpoints with worktree, branch, base/head SHA, diff summary, tests, screenshot paths, remaining items, and risks. Do not claim completion from a partial test run. Keep a per-item status/evidence matrix in this plan within the execution worktree.
7. After each review, fix the actionable findings in this same implementation chat, rerun affected verification, commit/push, and return exact evidence. No competing writers on the branch. Dedicated verification chats are read-only on source and report issues to the orchestrator.
8. Final acceptance requires all 18 items, automated plus manual/visual evidence, an independent whole-diff review, and final-head CI. No merge. Keep the PR draft while required checks/findings remain unresolved; report any unavailable verification honestly.

## The 18 changes

### 1. Media caption and answer spacing

Fix shared AttachmentPreview sizing at the cause: height restrictions belong to the media itself, not the wrapper containing its caption. Keep the caption in normal flow, and leave 16px between the complete media block and the answer. Verify the question form's former preview, hover previews, package inspector, and read-only views that still reuse the component.

### 2. File size beside duration

Show type, duration, and actual current attachment size, e.g. `Відео · 10 сек. · 2,4 MB`, using the existing byte formatter. Local/edited attachments use the accepted bytes' length. Remote-only attachments use cached HEAD Content-Length when available; otherwise display localized size-unknown text. Never show remote empty local bytes as zero, and do not download a full file solely for its size. Invalidate metadata when the source changes.

### 3. Styled native scrollbars

Add shared native scrollbar CSS using theme tokens: muted blue thumb, calm track, visible hover. Apply to pages, modals, and scrolling panels. Preserve touch/system behavior, intentionally hidden navigation scrollbars, and forced-colors accessibility. No custom scrollbar library or JS scroll wrapper.

### 4. Themed editor media player

Build a compact reusable editor player around native audio/video elements, reusing icons, formatting, and control styles. Include play/pause, seek, current/total time, mute/volume, and supported video fullscreen. Handle keyboard operation, loading, playback failure, source changes, narrow cards, and cleanup. Reuse this in attachment previews. Live gameplay retains its separate server-clock-controlled playback behavior; do not introduce editor seek controls into live gameplay.

### 5. Answer-type dropdown help

Use short dropdown options: Text, Number, Point on image. Put the selected option's explanation below the select, linked with aria-describedby. Remove parenthesized help from option names.

### 6. Seconds abbreviations

Use `сек.` in Ukrainian/Russian and `sec.` in English for textual duration suffixes. Keep clock notation mm:ss. Add/update all three locales, including accessible control names. Do not replace unrelated natural-language sentences mechanically.

### 7. Answer reveal duration input

Remove the unit from the label, make the input compact, and place muted `секунд` / localized `seconds` after it. For manual question saves require 2–30 seconds inclusive, with fractional values and incomplete typing retained locally. Invalid input explains the range and prevents Save question; no silent clamping. Opening/importing a package must not silently rewrite existing durations. When answer media is present, explain/display that its timeline determines the duration, and that this fallback field does not apply. Do not apply the 2–30 limit to individual media display durations or clip lengths.

### 8. Attachment delete overlap

Use a dedicated row for an accessible media-type icon and a nonshrinking Delete button. Image Show + duration + unit goes on a separate lower row. Ensure wrapping and card min-width rules prevent horizontal overflow. Preserve edit focus, attachment order, and per-occurrence edits.

### 9. Audio attachment appearance

Use the compact shared player from item 4. Remove duplicated Audio text and excessive blank height. Let controls wrap into deliberate rows instead of squeezing into native controls at 220px.

### 10. Highlight line-entry instructions

Semibold only the important first instruction (`По одній у рядку`, `Кожна допустима відповідь — з нового рядка`) for correct, alternate, and wrong answers. Keep the remaining explanation quiet. Use localization-friendly markup, preserve multiline typing/cursor/empty-line behavior, and avoid highlighting all helper text globally.

### 11. Comment placement and gameplay

Place the comment field before question text, describing it as a showman instruction before reading. Show it openly near the top of the showman's question UI, including relevant final phases; do not bury it in closed details. Remove it from the public answer reveal. Do not introduce a new game phase or pause timers. This is UI visibility, not a claim that the current protocol makes the field secret.

### 12. One-column form and interactive game preview

Remove the right column from the QUESTION EDITING FORM. Keep the package workspace inspector unless another listed item specifically changes it. Move settings into the form and replace the embedded preview with a prominent Preview button opening a nearly full-screen modal.

Field order: type/price; special-type settings; comment; question text/media; answer mode and its number/point parameters; accepted/wrong answers; answer media; timing; authors/sources. Maintain a single mounted form across viewport changes, media editing, preview, and return.

The simulator requirements and architecture are below.

### 13. Point radius slider and matching backend circle

Replace the percent number field with a 0–100% slider, showing current radius in image pixels. 100% means diameter = 1.2 * max(width,height). Use a 1px outline and subtle fill. Preserve existing/default radii on load rather than silently changing them; handle legacy out-of-slider-range values explicitly until the author adjusts them. Match the server and preview formula below, including round-trip and boundary tests.

### 14. Modal backdrop animation

Remove scale/translation animation from the shared fixed inset-0 overlay. Keep the backdrop static and full viewport; animate only the dialog content. Verify Delete round, other confirmations, nested dialogs, and reduced-motion. No oversized-overlay workaround is needed.

### 15. Save status is not a button

Replace the clickable save status with noninteractive status text and a save icon. Remove handler, hover affordance, pointer cursor, and tab stop. Keep timestamp updates and separate existing autosave error/retry behavior. Avoid a live region repeatedly announcing relative-time-only changes.

### 16. Discoverable package details

Give About package its own icon, surface/border, and spacing from rounds. Add an explicit header action on narrow screens as well, replacing the hidden details action formerly attached to save status.

### 17. Package actions and drafts

Use a consistent hierarchy on catalog/My packages: creation primary accent, upload blue secondary, navigation/preview quiet, deletion danger. Add an explicit Drafts link to the existing library. Create package uses the existing shared draft-creation helper, so Create and Drafts are distinct actions. Preserve auth, mutation pending/error states, and existing query invalidation.

### 18. Profile storage meter

Reuse StorageMeter and GET /v1/me/storage immediately below the profile page title. Apply the same thresholds everywhere: under 50% green, 50% to under 75% yellow, 75% and higher red. At/over 100%, clamp the visual bar and show full/over-limit context. Unlimited quota shows usage without invented percentages. Handle zero quota, loading, and request failure. Use the effective user quota from the API, never a hard-coded role limit.

## Local game simulator

- Read the current UNSAVED DraftQuestion and staged media. Do not autosave on preview. Explain invalid inputs that prevent the selected scenario, with navigation back to the affected field.
- Provide 3 test players, 1 showman, and 2 spectators. Default perspective is player, with player/showman/spectator switching. Before reveal, each perspective renders the same private/public information boundaries as the live UI.
- Normal showcase board: a few themes and price rows, all cells already played except this question. Randomize its position once per fresh launch and keep it stable throughout that run. Tests use deterministic randomness. Final preview has filler themes which are eliminated so the actual question remains last.
- Controls: Make someone answer, test-player selection, Continue, Restart, Pause. Continue advances the current scenario or submits the prepared answer; it does not arbitrarily jump over the type-specific setup.
- Default text is localized Test answer, editable by the author. Number answers accept a number, point answers use the actual picture picker, choice answers use actual options. Text remains showman-judged; automatic answer types mirror server evaluation. Scores/results must follow the chosen question's rules.
- Cover simple, hidden, delayed choice, stake auctions, secret recipient and custom-price selection, no-risk, for-everyone variants, and final theme elimination/bids/answers/review. Use current server behavior/tests as evidence; do not invent a second incompatible game.
- Reuse production board/stage/dock/media components, selectors and reducer. Introduce only the narrow scoped state/command boundary needed for a separate preview store and local event adapter. The normal provider keeps its live transport. Do not temporarily overwrite/restore the singleton live game store. Keep components small, hooks cohesive, and scenarios typed rather than one giant simulator hook/switch file.
- The simulator is local: no room creation, Socket.IO connection, publishing, stats/report submissions, real moderation, or account settings mutations. Suppress inappropriate real-game actions rather than rendering working network controls. Remote existing media may still be fetched for display.
- Lazy-load simulator code. Preserve the parent form, its scroll position and staged media. Pause parent previews on entry. On close stop timers/playback, release only simulator-owned resources, restore focus. Escape closes the top modal only; Ctrl/Cmd+Enter must not save the hidden parent form. Resizing/perspective changes must not reset the question session accidentally.
- Real timing/media behavior must be represented, with explicit controls to advance waits. Local simulated readiness is not evidence of real multiplayer downloads; test live gameplay separately.

## Point geometry contract and compatibility

Add optional `imageAspectRatio: number` to AnswerPointDTO / answerPoint: actual oriented image width divided by height. It must be finite and positive. The existing answer_point JSONB can hold it; no new database column is required.

For slider p and actual image width W, height H:

```text
radiusPx = (p / 100) * 0.6 * max(W, H)
answerDeviation = radiusPx / W
server distance = hypot(playerX - targetX, (playerY - targetY) / imageAspectRatio)
correct iff distance <= answerDeviation
```

Player answers remain the existing normalized `x,y` string. Evaluate rounding/zero-radius and exact-boundary behavior with the existing serialization. Do not trust dimensions supplied by an answering player; the server uses the package author's stored metadata.

Update server DTO/Joi/mappers as required, OpenAPI, generated WEB API declarations, web runtime protocol, draft/upload types, and .oq parsing/export so the optional field survives all paths. Correct metadata stays showman-only until reveal, matching answerPoint's existing transport boundary. Do not generate/edit Dart files; document the explicitly excluded generation.

Read dimensions from the FIRST question image. Editing/import/publication must use final accepted/optimized media, including direct archive uploads through the shared upload flow. Refresh metadata after relevant transformations. Preserve the existing target invalidation when first-image crop/rotation/removal changes geometry. If dimensions needed for a new web publication cannot be obtained, retain the draft and give a retryable publication error; never silently pretend a new circle was verified.

For published legacy point questions without aspect metadata, keep the old server distance behavior. Explain the legacy limitation in the editor/preview and upgrade on web republication. Do not bulk backfill old packages. A Flutter client that rewrites the object may omit the optional field; document that limitation without touching Flutter.

## Verification and evidence

- Maintain a matrix for items 1–18: implemented commit, automated checks, manual result, screenshot path, reviewer disposition. Keep logs/screenshots outside tracked source; permanent tests must not rely on a private snapshot directory.
- Unit/component: duration limits 2/30, invalid and fractional input, help text semantics, noninteractive save status, card controls, storage thresholds 50/75/100 and null/zero/error, simulator phases and isolation, stale callbacks and cleanup.
- Native browser: real audio/video controls and decode, metadata replacement, staging/save/cancel/undo/reload, published media, focus and viewport preservation, IndexedDB. Inspect actual rendered output, not DOM assertions alone.
- Geometry: landscape/portrait/square, center/edges, inside/on/outside boundary, default/zero radius, first-image replacement/crop/rotation, legacy fallback, invalid metadata, .oq round-trip, optimized output. Add focused backend rule tests and an actual HTTP/socket persistence-to-evaluation regression using existing harnesses. Cover shared normal/all-play checking where applicable.
- Simulator: every listed question variant, all 3 roles, custom text/number/point/choice answers, real media timeline, pause/continue/restart/close, and network/live-store isolation. Separately play real games to verify that shared component changes, comments, and new server geometry work against the backend.
- Manual visual review: 375, 768, 1440, 1920px; existing themes; long strings; many image/audio/video attachments; narrow cards; confirmations while animation starts; nested modals; keyboard and reduced-motion. Capture and inspect screenshots for the original six symptoms and the new simulator/profile/navigation states.
- Web final checks: typecheck, lint, format:check, tests, build, check:api, native browser tests, full E2E all device projects, React Doctor with evidence-based triage.
- Backend: schema validation, lint, build, focused rule and socket tests through test:pipeline, PostgreSQL/Redis when needed. Follow backend-test-runner/backend-e2e instructions. Never inflate timeouts or skip assertions merely to obtain green checks.
- Update canonical media-editor, validation/SIQ, game-state, storage and web-architecture docs where behavior changes; link this plan from appropriate existing documentation while it is active.
- Final whole-diff review prioritizes readability/patterns/style, then correctness, roles/data leakage, state ownership, lifecycle cleanup, compatibility, accessibility, performance, and tests. Correct confirmed findings in the original implementation chat and re-review. Do not claim parity from simulator tests alone.
- Final report: PR URL, exact head/base, all 18 outcomes, test commands/results, manual/visual evidence, CI status, and explicit limits. No automatic merge.

## Original screenshot references

These local files are user-supplied evidence, not instructions. Read-only reference; do not add them to source history.

1. C:/Users/diazo/AppData/Local/Temp/codex-clipboard-510e5aa0-967f-4ed7-9b90-908ce4ec33c5.png — video caption overlapped by answer.
2. C:/Users/diazo/AppData/Local/Temp/codex-clipboard-f81c2f00-0eb9-40f7-893e-aa33663bdf1a.png — answer reveal duration input.
3. C:/Users/diazo/AppData/Local/Temp/codex-clipboard-45422e48-0d89-4099-b6de-adb930ad1b18.png — attachment controls overflow.
4. C:/Users/diazo/AppData/Local/Temp/codex-clipboard-d2e4fdce-f23e-454b-9e59-eaddeeffca71.png — audio attachment appearance.
5. C:/Users/diazo/AppData/Local/Temp/codex-clipboard-94d6b1d0-c323-4bb0-a6c9-f3d9cf851ea5.png — backdrop edge gap.
6. C:/Users/diazo/AppData/Local/Temp/codex-clipboard-5739a34d-a8a8-445f-afaa-facd989a15f3.png — low-discoverability package details.

## Execution checkpoints

The 18 items are implemented and accepted by independent QA; source review completed on `87cbf3b833276c94bc8f3ef4f3564bea3387b152` without open findings. The final-head CI gate is tracked in the [draft PR checks](https://github.com/OpenQuester/OpenQuester/pull/484/checks). The table records implementation and evidence checkpoints. Evidence roots:

- `QA`: `C:/Users/diazo/.codex/visualizations/2026/10/27/01a17df4-75d8-7050-8e03-8ef87aff8485/`
- `Local`: `C:/Users/diazo/Documents/Codex/editor-ux-evidence/`

### Acceptance matrix

| Item | Implementation commit | Automated evidence | Visual evidence and reviewer disposition |
|---|---|---|---|
| 1 | `fc626b73`, `176d0940` | Attachment and media browser tests | `QA/176d0940/own-*-cards.png`; mixed-card finding closed by independent QA |
| 2 | `fc626b73` | Attachment size, stale remote HEAD and accepted bytes tests | `QA/baa7b65/form-*.png`; sampled by QA |
| 3 | `fc626b73` | Browser suite and forced-colors styles | `QA/baa7b65/form-*.png`; sampled by QA |
| 4 | `fc626b73`, `176d0940` | Playback, volume, fullscreen and real media browser tests | `Local/editor-fullscreen.png`; volume-zero finding closed by independent QA |
| 5 | `baa7b65f` | QuestionDialog help/description tests | `QA/baa7b65/form-*.png`; sampled by QA |
| 6 | `baa7b65f` | Locale and game display tests; fixed obsolete E2E assertion in `45c9b3bf` | `QA/baa7b65/form-*.png`; sampled by QA |
| 7 | `baa7b65f` | QuestionDialog range, fractional, media and legacy tests | `QA/baa7b65/form-*.png`; sampled by QA |
| 8 | `fc626b73`, `176d0940` | Attachment controls and mixed-media browser tests | `QA/176d0940/own-*-cards.png`; mixed-card finding closed by independent QA |
| 9 | `fc626b73`, `176d0940` | Real audio controls and staging browser tests | `QA/176d0940/own-*-cards.png`; sampled by QA |
| 10 | `baa7b65f` | Form tests for accepted answers and input history | `QA/baa7b65/form-*.png`; sampled by QA |
| 11 | `baa7b65f`, `8dc0d0d1`, `9176ed4f` | Game-stage and instruction browser tests for roles, phases and languages | `QA/584ebb14/{multiline,regular,url}-*.png`; independent QA closed ordering, labels and wrapping findings |
| 12 | `baa7b65f`, `584ebb14`, `45c9b3bf`, `56640d4d` | Web and simulator browser tests; independent real-game reconnect/media and three-player flow | `QA/45c9b3b/`, `QA/56640d4/LIVE-QA-REPORT.md`; offline and live QA accepted |
| 13 | `8cabd38a`, `87cbf3b8` | Geometry, archive, upload, rule and real HTTP/DB/socket checks; point reveal/rejoin normal, all-play and force-skip | `QA/8cabd38/`, `QA/87cbf3b/POINT-RECONNECT-QA.md`, `Local/point-radius-*.png`; independent geometry and reconnect QA accepted |
| 14 | `fc626b73` | Dialog and reduced-motion browser coverage | `QA/584ebb14/ordinary-dialog.png`, `nested-preview-staged.png`; shared backdrop inspected |
| 15 | `baa7b65f` | Editor shell and package editor E2E | `QA/baa7b65/form-*.png`; sampled by QA |
| 16 | `baa7b65f` | Editor shell and package editor E2E | `QA/baa7b65/details-375.png`; sampled by QA |
| 17 | `baa7b65f` | Package catalog, drafts and package editor E2E | `QA/baa7b65/catalog-actions-375.png`; sampled by QA |
| 18 | `baa7b65f` | Storage meter thresholds, zero/unlimited/loading/error and profile E2E | `QA/baa7b65/storage-*.png`; sampled by QA |

Initial screenshot: `C:/Users/diazo/Documents/Codex/editor-ux-evidence/editor-fullscreen.png` (automated Chromium screenshot, visually inspected). This initial evidence was supplemented by the independent visual matrix above. Docker Desktop startup failed on inaccessible `Docker/run/dockerInference`; no reset performed.

### Media review follow-up

At `176d0940a3afbb1538ec72332f9b4c21f8969ad6`, independent QA closed both volume-zero restore and mixed-card stretching findings. Evidence: `C:/Users/diazo/.codex/visualizations/2026/10/27/01a17df4-75d8-7050-8e03-8ef87aff8485/176d0940/own-{midnight,daylight}-{375,768,1440}-cards.png`. QA reported 15 focused Vitest and four browser cases passing. These findings were resolved at this checkpoint.

Stage 2 working tree: desktop package-editor E2E 7/7 and profile/storage/package E2E 7/7 passed against the owned backend stack. Full web Vitest passed 353/353 with two workers; default worker count had timeouts under local load. The interactive simulator has since replaced the static modal; see the latest matrix for acceptance.

Zero-radius precision decision: modern points compare both coordinates at the existing three-decimal web wire precision when radius is zero; imported stored targets remain unchanged. Positive radii use the specified circle formula, and legacy metadata-free checking is unchanged.
Preview evaluates a separate copy using the current first staged image dimensions, including for a legacy draft, without saving metadata or optimizing media. Existing published legacy questions retain legacy server checking until web republication; publication measures its final output bytes.

Stage 2 follow-up: independent QA on `584ebb14c54c337acab67f809f706f9b698b4602` closed showman-instruction ordering, labels, long-token wrapping and preserved newlines, as well as nested-preview focus/scroll restoration. QA reported 37 focused tests, 6 instruction browser cases and one scroll browser case passing. The interactive simulator was added later at `45c9b3bf`.

Geometry checkpoint: server point checking, validation and real Socket.IO scoring passed; native browser tests exercised landscape, portrait, square and EXIF-oriented optimization plus archive import through the actual upload request. A full native browser run found one ambiguous Package details test locator after the new toolbar action; the scoped locator passed on rerun. That checkpoint did not yet establish final acceptance.

Independent geometry QA at `8cabd38ae802541460b590ffd9ea8d39d0208501`: 34 Vitest, 6 browser, 14 server rule tests, one normal HTTP/DB/socket flow and one all-play flow passed. Screenshots and findings: `C:/Users/diazo/.codex/visualizations/2026/10/27/01a17df4-75d8-7050-8e03-8ef87aff8485/8cabd38`. The browser upload POST was mocked; server persistence/scoring was verified separately through the real server harness.

The user subsequently approved a narrow backend exception for a confirmed pre-existing wrong-answer transition bug. With other players remaining, choice and hidden questions now return to showing and restore their saved timer, as simple questions already did. Scoped real Socket.IO tests cover three players, subsequent buzz, correct answer, exhaustion and single-answerer regression; later review accepted the scoped fix.

Simulator checkpoint: all 385 web Vitest tests and six focused browser cases passed, including staged content, role separation, keyboard/focus, mobile point/final screens, and media isolation. Typecheck, lint and API type check passed. The local stack was rebuilt with the approved buzzer fix. Independent review and final-head CI were pending at this checkpoint.

Independent offline QA on `45c9b3bf` exercised simulator isolation, question types, roles and mobile all-play/final flows; exclusive live-game QA was pending at that checkpoint and later passed as recorded below. A follow-up clarifies review instructions for the selected role, simplifies final-theme labels, and aligns the new socket test with the shared scenario lifecycle. On `45c9b3bf`, CI reported the socket policy violations and a flaky web timer test. The policy check passes locally after the test correction; fake timer scheduling is an unconfirmed hypothesis for the web failure; the subsequent Linux web CI passed. The form test preloads its lazy module before checking form state; browser coverage retains the real lazy-open path.

React Doctor changed-scope scan at `45c9b3bf` reported 78/100, no errors and 16 warnings. Review found no actionable regression in the small static lists, scoped context or explicitly released object URLs. Media captions remain a limitation of the existing attachment model; no empty tracks or suppressions were added.

CI evidence at `56640d4d`: native Chromium passed 45/45, and full backend E2E passed 134 with 16 pre-existing device-specific skips. The job reached its 25-minute limit during cleanup after all assertions passed, so the GitHub check was cancelled. Its overall budget is increased to 35 minutes for cold setup, both full suites and cleanup; individual test timeouts, retries, assertions and coverage are unchanged. A fresh exact-head CI run is required.

Independent live QA at `56640d4d`: `QA/56640d4/LIVE-QA-REPORT.md` records reconnect/media 2/2 and a three-player choice flow 1/1, including independent preview in another tab. It also confirmed a pre-existing limitation, subsequently fixed and independently retested: during normal and all-play point-answer reveal, reload loses the image/circle for showman, player and spectator because the snapshot clears `currentQuestion` and does not retain its image. The later backend-contract fix was approved as noted below; the diagnostic's zero exit status is not a pass for that behavior.

The user subsequently approved the point-reveal reconnect fix in this PR. The additive `answerPointImage` reveal field retains only the first question image URL; active question lifecycle, scoring and final-round UX remain unchanged. The independent QA result is recorded below; final-head CI remains the PR gate.

Independent point reconnect QA at `87cbf3b833276c94bc8f3ef4f3564bea3387b152` closed the previous finding: a strict real browser/server test passed twice for normal correct, no-risk forEveryone, and force-skip across showman, player and spectator, before and after reload. QA verified the 2:1 rendered circle, target, radius, aspect, image URL and pre-reveal privacy; web snapshot and legacy fallback tests passed 2/2. Evidence: `QA/87cbf3b/POINT-RECONNECT-QA.md`. This does not claim a change to final-round UX or untested older clients.

# React editor and game preview: 36 browser annotations

Status: implementation in progress; the per-item ledger below is the current status. Starting revision: `71a6eab30b62e61c4f9e40c334ad5fca8fb3d2bf`, draft PR [#484](https://github.com/OpenQuester/OpenQuester/pull/484). This follow-up supersedes earlier acceptance only for the newly reported cases; previous checks are historical evidence, not proof these cases work.

## Ownership and boundaries

- Orchestrator/reviewer: `01a17dd2-f558-7f60-9e97-85f816942ca3`.
- Sole implementation writer: `01a17df3-6458-7223-bdce-a41d98dbc49c`, worktree `C:/Users/diazo/.codex/worktrees/d643/openQuester`, branch `codex/web-editor-ux-playtest`.
- Independent QA: `01a17df4-75d8-7050-8e03-8ef87aff8485`; read-only on production source.
- Both execution chats use `gpt-6.1-terra`, `xhigh`, with new goals and no invented budgets. Keep one existing PR, draft, without merge.
- React `web/` is the target, including the real React game where requested. Do not modify Flutter or generated Dart. The user authorized narrow server/API changes for items 28, 32 and 33 as described below; other server work still needs its own scope review.
- Root owns this initial brief; the implementation chat owns its subsequent implementation plan and acceptance updates. Root reviews but does not implement runtime fixes.
- Preserve the dirty original `C:/openQuester` checkout. Never reset, clean, stash, switch, or mix its unrelated work.
- The user's app used `http://localhost:5173` with API `53000` and WSL Docker compose `oq-web-e2e`; it is currently stopped, and a restart was blocked by automatic policy review. Preserve its data and browser tab: do not reset, seed, clear storage or modify the user's draft for QA. Reproduce in an isolated browser context and separate agreed test runtime where needed; HMR must not discard unsaved user work.

## Required workflow

1. Read AGENTS, relevant specs, Ponytail full, package-editor-change, docs-upkeep, React guidance, and React Doctor. Use UI guidelines for UI review; use backend/socket/test skills only when those layers actually need inspection or approved changes. Do not apply Flutter skills to React.
2. PLAN FIRST: inspect owners and callers, map all 36 IDs below to root causes/files, spell out behavior and a minimal verification plan. Add an execution ledger in this file. No runtime edits or commits until root accepts the plan and explicitly releases item 1.
3. Work on ONE released annotation at a time, normally in numeric order. Shared fixes may incidentally address later IDs, but retain and independently verify every ID; do not mark later IDs accepted silently. Root may explicitly release a coherent dependent step when appropriate.
4. For each step: reproduce before, implement the smallest complete shared fix, run appropriate checks, capture before/after visual evidence, and return the exact diff/files plus tests to root. Then wait. Root reviews correctness, readability, naming, responsibility boundaries, accessibility, existing patterns, and real UI evidence. Address findings in this same implementation chat. **No commit until root explicitly approves that concrete diff.** A previous approval does not cover later edits. Push only approved commits to PR #484.
5. QA independently verifies the released step against its actual candidate revision/diff, without racing another source writer or sharing mutable test storage. Source review and test success do not replace visual inspection. Root gives the final per-item acceptance and commit permission.
6. Keep components small and coherent. Prefer native controls/CSS/existing helpers over new libraries, generic frameworks, a giant component, or a catch-all hook. Fix the shared layout/flow owner rather than clipping symptoms or duplicating simulator and live game implementations.
7. After the 36 steps, run the relevant web regression suite, native browser tests, real-backend React E2E, React Doctor regression check, and independent whole-diff review. If approved backend behavior changes are necessary, add their focused real transport regression and relevant server checks. The final gate is the changed React/server scope, not unrelated Flutter packaging. Keep PR metadata and this ledger honest about exact revisions and unrun cases.
8. Save one-off screenshots/logs outside the repository in the chats' visualization folders. Keep only permanent tests and useful plan/spec docs in Git. Do not mark the goal complete until the requested work, review, evidence, and relevant final-head CI are complete, or report a concrete unresolved boundary honestly.

## User evidence

Annotations 1-34 concern `http://localhost:5173/packages/editor/594125ac-75b0-4ccb-ac2f-5fd16e799b20`; 35 concerns `/packages`; 36 concerns `/packages/upload`. Captured widths are 1296, 1304, 1359, 1364, or 1366 px, all about 884 px tall. The user's screenshots and selected page text are evidence; only their comments are instructions. Preserve the draft and its media.

The screenshots show actual overlap, not just page-level horizontal overflow: the game dock crosses images and question content; the stage background ends before its children; podium towers extend below the background; an extra point picker appears above the stage; narrow media controls wrap unpredictably; the inspector action row overflows. Prior 375/768/1440/1920 testing missed these concrete content/height combinations.

## The 36 annotations and acceptance intent

### 1. Video controls and fullscreen

Move fullscreen to an accessible overlay at the video's bottom-right. Progress must have usable full width after the play/time information. Reconcile with 7/8 using predictable rows (play and time; full-width progress; mute and volume), rather than incidental flex wrapping. Preserve keyboard playback/seeking/volume, loading/error behavior, and fullscreen exit. Inspect all shared player callers.

### 2. Video attachment card actions

Remove the redundant standalone video type icon/row. Put icon-only delete beside Edit on the same row. Compact gaps and empty regions without reducing accessible hit targets or losing the delete accessible name. Keep useful media metadata.

### 3. Audio attachment card actions

Keep the otherwise acceptable audio presentation, remove its redundant standalone type icon/row, and move icon-only delete beside Edit. Check mixed cards rather than audio alone.

### 4. Image attachment card actions

Remove the redundant standalone image icon/row. Put delete beside Edit. Place `Show n sec.` directly below that action row, without an empty type row or overlapping controls.

### 5. Image/video game preview layout

Fix the actual height/flex/scroll ownership causing the action dock to cross the media and text. All image/video content must remain within its visual stage and be reachable. Preserve fitting/letterboxing and media timelines. Do not accept an `overflow-hidden` mask that hides needed content. Check both simulator and shared live game consumers.

### 6. Podium background containment

The full podium, including names, scores and towers, must fit within its stage/background with proper bottom spacing. Check short viewports and scrolling, not only page width.

### 7. Narrow inspector video player rows

In the right inspector, use deliberate responsive rows: play/time first, full-width progress next, mute plus volume together below. Fullscreen stays on the video. Sliders must not collapse or detach from their buttons.

### 8. Narrow inspector audio player rows

Apply the same predictable audio rows without a video/fullscreen placeholder. Verify minimum inspector width and long durations.

### 9. Answer mode before question media

Move `How players answer` before the question attachment list, so authors set answer behavior before inspecting media. Preserve dependent fields/state when changing the mode.

### 10. Desktop price/comment row

On sufficiently wide form content, place price and comment in one row, approximately 20/80. Keep comment above the question and retain its help. Stack naturally on narrow forms; use actual available form width, not an unrelated viewport breakpoint.

### 11. Desktop question/answer-mode row

Place question text and answer-mode dropdown/help in a shared wide row, approximately 70-80% / 20-30%. The dropdown remains before question media in DOM/keyboard order. Stack without losing staged state on narrow forms.

### 12. Correct/wrong answer layout

Where text answers are relevant, place correct and wrong answers side-by-side on desktop, with showman hint below both. Stack on narrow screens. Keep per-line guidance noticeable and validation associated with the right field.

### 13. Inactive reveal-duration fallback

When answer media defines the timeline, visibly disable/gray the fallback duration input and make its explanation clear. Do not lose its stored fallback value; removing the last answer media re-enables and revalidates it. Avoid presenting a disabled value as an active validation failure.

### 14. Answer section divider

Add a subtle theme-consistent horizontal separator before the answer-related section, reflecting semantic grouping rather than extra decorative containers.

### 15. Attribution divider

Add a similar separator before authors/sources so attribution is distinct from question/answer content.

### 16. One duration validation message

Do not render the same limits as both help and error simultaneously. Show one useful associated message, with error semantics/styling only when invalid. Keep required 2-30 second validation intact.

### 17. Inspector overflow and resize

Fix the right panel's horizontal overflow at the user's 1296 px viewport, including player controls and the edit/move/copy/delete row. Add bounded desktop resizing using existing project patterns/native pointer behavior; propose concrete min/max and main-content constraints in the plan. Provide keyboard-accessible resizing, clamp on viewport changes, preserve responsive/mobile behavior, and avoid new layout dependencies. Do not silently persist arbitrary unrelated settings.

### 18. Point-answer inspector summary

For point answers, show a localized summary such as `Point on image 1 - <coordinates>` instead of stale generic answer text. Coordinates must visibly afford interaction. Hover/focus temporarily displays the correct target/radius on the corresponding question image; click/keyboard toggles it persistently until clicked again. Temporary hover and pinned state must interact predictably, reset when the selected question/image changes, and remain read-only. Reuse canonical image ordering/aspect/radius geometry; no answer leaks into player views.

### 19. Round heading/action row

Keep Normal/Final, Add theme, and the menu beside the round heading when content width genuinely allows it. Let them wrap at a meaningful narrow breakpoint, without imposing an unnecessary full-width heading row. Preserve long round names and localization.

### 20. All-play stake wording

Clarify that everyone both bids and plays/answers, rather than only placing simultaneous bids. Verify actual game rules and update relevant locale wording consistently.

### 21. Bidding controls in preview and live React game

Move suggested bid buttons above the submit button. Add a slider next to the numeric input (roughly 70/30 width), with the submit button below. Slider/input must stay synchronized and use the existing authoritative allowed minimum, maximum, step and player-score rules, including low/zero/negative scores, all-in and pending states. Do not invent a client-only scoring rule. Use the shared real-game control so preview and game agree.

### 22. Duplicate point controls above the stage

The screenshot shows a large extra point-answer picker in simulator settings above the actual game point picker, causing duplicated interaction and broken layout. Remove redundant fake-player answer input when the selected player perspective can answer through the real game UI. Trace any genuinely duplicate dispatch separately; one gesture must cause one intended answer.

### 23. All-play point preview geometry

Verify/fix the all-play point stage where the action dock bisects the image and content extends below the stage background. Exercise the real flow and scrolling, not only static DOM assertions. Reuse the root fix from 5 if sufficient, with independent acceptance evidence.

### 24. Number-answer authoring fields

Hide irrelevant correct/wrong free-text answer fields for numeric answers; retain showman hint and the actual numeric target/tolerance controls. Trace validation, publication and answer reveal so the author can still save/play/publish. Do not destructively erase existing hidden text when changing modes unless the data contract demands an explicitly reviewed migration.

### 25. Reveal timing near reveal content

Move answer reveal duration into/adjacent to `Shown with the answer`, where reveal text/media are configured. Retain inactive-fallback semantics from 13 and the single message from 16.

### 26. Remove redundant price explanation

Remove the extra paragraph explaining that greater value means greater win/loss in the relevant special-question price stage. Keep essential state/action feedback. Review shared live/preview usage and unused locale keys.

### 27. Simplify simulator actor controls

Remove the redundant `Test player` and prepared test-answer controls when authors can choose a player perspective and use its normal answer UI. Preserve a clear way to progress host/spectator testing and complete every question type, including final/manual review, without reintroducing a second oversized answer interface. Document the minimal interaction model before implementing; avoid hidden actor/perspective mismatch.

### 28. Correct-answer wording and submitted answer

Use `answers correctly` / Ukrainian `відповідає правильно`, rather than `guesses`. In the appropriate result/review area show what the player actually submitted as text (not the canonical answer substituted for it). Apply in simulator and live React game. Respect role/phase secrecy: do not expose unreviewed simultaneous answers prematurely. Trace available server events/snapshots before fabricating missing data.

### 29. Accurate multiple-result summary

Reproduce the case where one player answered correctly and another was accepted during review, yet the reveal says nobody answered correctly. Summarize accepted results from actual authoritative state, including multiple correct, manual acceptance, zero-point correctness and negative scores. Keep empty/unanswered/incorrect distinct. Check live and simulator parity and reconnect evidence where applicable.

### 30. Remove explicit media-undo button

After deleting an image, remove the `Undo media change` button and do not replace it with new shortcut help. Preserve the user's expected existing Ctrl+Z recovery through the actual owning edit/history scope, and cancel/discard behavior; confirm it rather than assuming global undo reaches staged media. Trace all callers before removing a shared action.

### 31. Choice preview layout

Verify/fix long/mixed choice content with question images and option media: the dock must not overlap the image/text/options and all options must remain reachable. Independently validate the shared layout fix from 5 at the user's dimensions.

### 32. Visible rejected choice

When a player submits an incorrect choice, make that option's rejected state visible and prevent selecting it again as required by the reported flow, for every relevant player view. Trace existing public choice-result/attempt state and lifecycle resets. Do not guess from private answer keys, leak a correct option before reveal, or add an optimistic UI-only game rule. Check another player, reconnect, next question, and keyboard selection.

### 33. Automatic choice evaluation

An actual clicked choice should be evaluated automatically in both simulator and real React game, rather than entering manual showman review. The screenshot includes a media option rendered/submitted as `5`; inspect option IDs/indexes, answer type, payload conversion, authoritative evaluation and malformed-input fallback. Preserve intentionally manual spoken/text answers. If the server lacks the required contract/behavior, report the exact minimal boundary for approval rather than faking server results in React.

### 34. One neutral zero-point action

Replace separate `Correct, 0` / `Incorrect, 0` actions with one localized `Skip, 0` action. The shared host dock emits the existing `answer-result` command with `answerType: skip` and `scoreResult: 0`; retain the existing pending and paused guards and other scoring actions. The authoritative handler continues with eligible players or reveals after exhaustion, and preview keeps the same skip classification without rejecting a choice. A skip increments answered-question statistics, but neither correct nor wrong counts. Verify the host action, zero score, continuation and image choice reuse in preview; update the existing live E2E scenario to use the new action. No backend or contract change is needed.

Candidate verification: focused dock and preview tests pass (49/49), including emitted payload, pending state, unchanged score, retained skip classification and reuse of the image choice. Isolated native preview at 375 and 1296 px showed the localized action in EN/UK/RU, continuation to another player and no judge control for a spectator. The live E2E scenario was updated; it was not run locally because the shared backend is reserved for independent QA.

### 35. Dropdown arrow spacing

Keep the shared native select and its consumer sizing. For single-select dropdowns, render a theme-colored CSS arrow inset from the edge and reserve space between it and the selected text. Preserve native appearance for multiple/size listboxes and forced colors; the underlying select retains labels, keyboard, focus and disabled behavior. Verify catalog and other consumers at mobile/desktop, in both available themes and all locales.

Candidate verification: isolated Chromium catalog at 375 and 1296 px, both available themes and EN/UK/RU, with the longest language option selected; measured 48 px right padding and no text/arrow collision or horizontal page overflow. Keyboard selection and focus worked; disabled, `multiple`, `size=3`, `size=1` and forced-colors native fallback were checked with actual rendered shared controls. Typecheck, lint and the focused controls suite passed; screenshots are retained outside the repository.

Increase right inset/spacing around the package language dropdown arrow by a few pixels using the shared select styling where appropriate. Verify text does not collide with the arrow, including long localized labels and focus states.

### 36. Discord login action on upload

When runtime auth settings expose Discord sign-in, show the existing OAuth action with Discord icon and brand styling on the upload gate. Preserve the intended return-to-upload flow, provider loading/error states, and the truthful unavailable message when Discord is not configured. Do not hardcode dev-server availability, require a real OAuth sign-in to prove rendering, or change account/server configuration.

## Evidence and acceptance requirements

- Reproduce the user's 1296/1304/1366 x 884 viewports as well as small/short screens, with mixed actual image/video/audio, long labels, multiple choices, point and number answers, stake/all-play/final, and both relevant themes/locales.
- For layout bugs assert element containment and dock/content non-overlap, then inspect whole-modal/page screenshots. `document.scrollWidth <= clientWidth` alone cannot prove the stage is correct. Do not substitute cropped screenshots that conceal the overflow.
- Exercise form resizing without remounting or dropping staged media, input drafts, scroll position or focus. Protect autosave/undo, object URL ownership and accepted media bytes.
- Separate simulator evidence, real live-game evidence, mocked auth/provider rendering, and server transport evidence. Label each honestly.
- Build a per-ID ledger with owner/files, reproduction, proposed minimal change, automated/manual/visual checks, root review notes, acceptance status and approved commit SHA. Keep all 36 IDs visible even if a shared fix covers several.
- At completion verify no `client/` diff, no unapproved server expansion, clean approved worktree, unchanged unrelated original work, exact final PR head and relevant CI, and a usable localhost for the user.

## Implementation plan and per-ID ledger

Planning snapshot: `71a6eab30b62e61c4f9e40c334ad5fca8fb3d2bf`; this section is based on source inspection, not a new browser reproduction. All 36 IDs start **planned**, with no approval or commit. A selected item's observed before/after evidence and root review are recorded as it proceeds. Only the current released item may be edited; a later item sharing its owner stays unaccepted until independently checked.

### Cross-cutting decisions and unresolved boundaries

- **Safe evidence:** use a fresh, isolated Playwright browser context and fixture-owned IndexedDB; where an actual backend is necessary, use an independently agreed API/DB/Redis/S3 stack and ports. Never run `e2e:full` against the user's `5173`/`53000` stack or import/change draft `594125ac-75b0-4ccb-ac2f-5fd16e799b20`. Store before/after full viewport PNGs and logs under the task visualization directory; identify exact width/height, theme, role, phase and revision. Record fixture/stack ownership before any mutating test. React tests, isolated preview and actual live transport are separate claims.
- **One item and approval:** inspect/reproduce, implement, focused regression and screenshot, then send root exact diff and results. Await explicit review/commit approval for that exact diff; then commit/push. No next item without explicit release. Shared items 1/7/8, 2/3/4, 5/6/22/23/31 and 9–16/24/25 may benefit from earlier work but remain separately verified and approved.
- **Height owner, 5/6/23/31:** probable flex-height cause, to prove via bounding boxes before editing: `Dialog` uses a `min-h-0 flex-1 overflow-y-auto` wide flex container; preview wrapper and `PlaytestSession` use `min-h-full`, while the stage is `shrink-0 ... sm:flex-1` (`flex` shorthand can override shrink) and the shared dock is `sticky bottom-0`. `GameStage`/`QuestionStage` children are intrinsically taller than the proposed stage; podium towers also have fixed heights. Measure each ancestor's client/scroll height, computed flex/shrink, stage/dock/content rectangles and scroll extent at 1296/1304/1359/1364/1366×884 and a shorter viewport. Fix the actual scroll/flex owner, preserve full content and dock access, and validate the real `GameScreen` consumer separately. Do not mask content with clipping. Recheck 6, 23 and 31 individually.
- **Inspector sizing, 17:** start width 360px; propose min 320px, preferred max 600px, and minimum 480px for workspace after the 272px outline, bounded by actual available row width. If the available range cannot accommodate the minimum, fall back to existing non-inspector behavior instead of overflowing. Desktop separator must expose keyboard arrows, Home/End, current/min/max values, pointer capture and resize clamping. Keep width session-local unless an approved requirement says otherwise; use a measured container and existing breakpoint (`wide` at 1280px), not a global arbitrary viewport assumption. Confirm outline/borders/padding in real layout before final constants.
- **Actor model, 22/27:** current `PlaytestSession` has independent perspective, actor, per-actor prepared answer and a second point picker, while production `PointAnswer` already emits the selected player's command. For 22 remove duplicate only when real UI handles the selected player and retain workable progression until 27 is released. For 27 make the selected player perspective the acting player; real game controls enter answers. Showman/spectator can advance deterministic setup and inspect/review but must be prompted to switch to an eligible player when player input is required. `Continue` must not invent or silently submit an answer. Preserve clear handling for other players, secret receiver, stake, all-play/final, pause, keyboard and manual review; test each phase before choosing the smallest implementation.
- **Form history, 30:** `useQuestionMedia` keeps separate one-step undo for add/edit, not deletion; deletion calls `onGeometryChange` but discards its undo closure. The package-wide shortcut explicitly excludes dialogs and text inputs. Implement a form-scoped, most-recent media operation undo that restores the affected occurrence, original point target and staged bytes without reverting unrelated form edits; scope Ctrl/Cmd+Z to the active question editor, avoid inputs/contenteditable/IME/preview/media-editor conflicts, retain cancel/discard and focus. Confirm add/edit/delete and both lists before removing the button. Do not claim global package undo covers staged changes.
- **Authoritative boundaries, 24/28/29/32/33/34:** (24) `validatePackage.checkQuestion` warns for missing `answerText` even with `answerNumber`; `toUploadQuestion` forwards text and target separately, while `ShowAnswerLogic` reveal includes `answerText` but not `answerNumber`. Hiding fields alone can make a numeric reveal blank/stale. First evaluate deriving the numeric reveal text at web publication/preview without mutating hidden draft text; check 0, negatives, locale-independent transport, legacy values, reconnect and archive/export round-trip. `toUploadQuestion` is shared, so do not accidentally discard hidden text in .oq exports. Escalate only if an existing web path cannot meet the contract. (28) `answer-submitted` broadcasts text, but reducer clears `submittedAnswer` on result and `answeredPlayers` has no text; all-play review contains authoritative answers. Preserve role/privacy and distinguish connected-session evidence from reconnect. (29) `AnswerReveal` currently looks only at `answerShowData.answerResult` or the last `answeredPlayers`; `allPlay.entries` carries player/isCorrect/scoreChange through review and is retained until board reset. Verify snapshot retention and classify by correctness, never by score sign. (32) `useAnswerChoices` selection is component-local and reset on answering-player change; `answer-result` has player/type/score but no selected option, and rejoin snapshot has no attempted-option identity. A client-only reconstructed wrong pick cannot satisfy all-role/reconnect semantics without verified evidence. (33) `optionAnswer` sends text or collision-safe number/#number; server `ChoiceAnswerLogic` only matches nonempty option text and right-answer text, so image-only picks fall back to manual judgment. Trace exact package representation, stable identity and server validation; ask for an explicitly scoped server/contract change if necessary, never auto-score optimistically. (34) existing protocol has `answer-result` with `answerType: skip` and score zero; server treats skip as non-correct and stats don't increment correct/wrong, but preview `judge` currently collapses skip to wrong. Verify role/phase, exhaustion/turn and stats before wiring shared UI and preview; do not pretend a wrong/correct zero is neutral.
- **Browser and accessibility:** native buttons/ranges, theme tokens and existing icon primitives; keyboard/focus, 44px targets, long labels, both themes and all en/uk/ru strings as applicable. Test actual element boxes/scroll reachability, not just document horizontal overflow. Do not add dependencies to solve layout.
- **Final gate:** after all individual approvals and commits, clean worktree; no `client/` diff, no unapproved backend edits; React typecheck/lint/format/unit/API checks, native browser, agreed isolated real-backend E2E, React Doctor regression, final independent source/visual review and relevant exact-head CI. PR remains draft; no merge. CI/test coverage must distinguish historical checks from current head.

### Per-ID ledger

The **Reproduce / smallest change / verification** column is the initial hypothesis and work plan; it does not assert that the bug was already reproduced or fixed. `B` means isolated actual browser plus full viewport screenshots; `U` means focused component/unit; `L` means separately owned real live-game/backend flow. Every row starts Planned; append actual evidence, root disposition, acceptance and approved commit SHA when released.

| ID | Owning files | Reproduce / smallest change / verification | Status / root / commit |
|---|---|---|---|
| 1 | `EditorMediaPlayer.tsx`, `AttachmentPreview.tsx`, `EditorMediaPlayer.test.tsx` | B: real video in question card, inspector and fullscreen; put fullscreen on video overlay, preserve container fullscreen controls/focus/exit, play/time then width-aware seek and volume. U: loading/error, keys, seek/mute; B: 1296/1366 and small width. Inspect all callers. | Accepted; root and independent QA approved |
| 2 | `question-form/QuestionMediaList.tsx`, `questionFormStyles.ts` | B: video mixed card; remove standalone type row, edit + icon delete with accessible name/hit target; preserve metadata. U/B: focus, delete, geometry and staged data. | Accepted; root and independent QA approved |
| 3 | `QuestionMediaList.tsx`, `AttachmentPreview.tsx` | B: mixed audio/video/image; same action row without duplicate icon, preserve compact audio player and metadata. U/B: accessible remove and no overflow. | Accepted; root and independent QA approved in shared item 2 commit |
| 4 | `QuestionMediaList.tsx` | B: image card; same edit/delete row followed directly by show duration; U/B: fractional duration, removal and point invalidation. | Accepted; root and independent QA approved in shared item 2 commit |
| 5 | `playtest/PlaytestSession.tsx`, `ui/Dialog.tsx`, `game/play/GameScreen.tsx`, `question/questionStyles.ts`, `dock/actionDockStyles.ts` | B/L: image/video + long content and dock at 1296–1366×884 and short screens; measure shared scroll/flex root, choose minimal non-clipping fix, test stage containment/dock overlap and complete scroll reachability in preview and live. | Accepted; root and independent QA approved |
| 6 | `playtest/PlaytestSession.tsx`, `game/play/GamePodium.tsx`, `stages/stageStyles.ts` | B: finished 3+ players at 1296×884 and short viewports; verify headings/names/scores/towers/background and bottom spacing. Reuse 5 only if evidence proves it; U for ranking unchanged. | Accepted; root and independent QA approved using earlier shared fix |
| 7 | `EditorMediaPlayer.tsx`, `QuestionPreview.tsx` | B: 320–360px inspector video, long duration; use intentional play/time, full-width seek, mute/volume rows and overlay; verify keys/fullscreen/no overflow after 1. | Accepted; root and independent QA approved using earlier shared fix |
| 8 | `EditorMediaPlayer.tsx`, `QuestionPreview.tsx` | B: narrow audio inspector, long duration; same rows without fullscreen placeholder; confirm seek/volume widths and a11y. | Accepted; root and independent QA approved |
| 9 | `question-form/QuestionContent.tsx`, `QuestionTypeSettings.tsx` | U/B: move answer mode before question attachments, verify keyboard order, mode-dependent target and staged data survive switches; coordinate 11/24 later. | Accepted; root and independent QA approved |
| 10 | `QuestionContent.tsx`, `QuestionFields.tsx`, `questionFormStyles.ts` | B: desktop form widths including 1296 and narrow; price/comment 20/80 by available container, stack with long labels; U: comment/order/validation unchanged. | Accepted; root and independent QA approved |
| 11 | `QuestionContent.tsx`, `QuestionTypeSettings.tsx` | B/U: question text and mode/help 70–80/20–30 in same wide container row, DOM order before media, narrow stack, preserve focus/state and type-specific targets. | Accepted; root and independent QA approved |
| 12 | `QuestionContent.tsx`, `LinesField.tsx` | B/U: correct/wrong text side by side, hint below; narrow stack, guidance/error association and multiline cursor. | Accepted; root and independent QA approved |
| 13 | `QuestionContent.tsx`, `useQuestionForm.ts`, `ui/Field.tsx` | U/B: answer media toggles disabled visual and description; invalid fallback retained without active error, re-enabled/revalidated after last removal, reload and cancel. | Accepted; root and independent QA approved |
| 14 | `QuestionContent.tsx`, `questionFormStyles.ts` | B: semantic answer boundary after question on wide/narrow; use a theme-token separator, no extra decorative wrapper; verify ordering/focus. | Accepted; root and independent QA approved |
| 15 | `QuestionContent.tsx`, `questionFormStyles.ts` | B: attribution group on wide/narrow; theme-token separator, no duplicated semantic grouping. | Accepted; root and independent QA approved |
| 16 | `QuestionContent.tsx`, `ui/Field.tsx` | U/B: invalid duration produces exactly one aria-associated message/error; valid/media-active explanation no duplicate or false invalid state; retain fractional 2–30 validation. | Accepted; root and independent QA approved |
| 17 | `PackageEditorShell.tsx`, `shell/PackageEditorInspector.tsx`, `shell/packageEditorShellStyles.ts`, `shell/usePackageEditorShell.ts` | B: 1296×884 and resize 1280→1920, action row/player sliders; implement bounded accessible local resize per constants above, keyboard/pointer, resize clamp, min main and mobile fallback. | Accepted; root and independent QA approved |
| 18 | `QuestionPreview.tsx`, `AttachmentPreview.tsx`, `PointPicker.tsx`, locales | B/U: point answer selected in inspector; localized coordinate control, hover/focus temporary vs click/Enter/Space pinned, reset on question/image, existing first-image circle; no player/game disclosure or mutation. | Accepted; root and independent QA approved |
| 19 | `board/RoundHeader.tsx`, `board/packageBoardStyles.ts` | B/U: normal/final heading, controls and long names at available row widths; adjust flex basis/wrap, preserve editing/menus and localized strings. | Accepted; root and independent QA approved |
| 20 | locales `en/uk/ru`, `QuestionTypeSettings.tsx`, `AllPlayStages.tsx` | U/B: compare authoring/actual all-play stake rules and copy; consistently say all players bid and answer; verify long localized labels. | Accepted; root and independent QA approved |
| 21 | `game/play/dock/BidControls.tsx`, `DockAction.tsx`, `specialModels.ts`, `allPlayModels.ts`, `finalModels.ts`, selectors | U/B/L: regular auction, all-play and final; suggestions above input+slider, submit below; authoritative min/max/all-in/step, invalid/zero/negative score and pending. No invented increment; reproduce actual server constraints first. | Accepted; root and independent QA approved |
| 22 | `playtest/PlaytestControls.tsx`, `PlaytestSession.tsx`, `game/play/question/PointAnswer.tsx` | B: point in preview answering/all-play; remove duplicated prepared picker where real selected player can answer, one gesture→one event, preserve host/spectator/final until 27. Verify stage containment separately from 5/23. | Accepted; root and independent QA approved |
| 23 | `PlaytestSession.tsx`, `QuestionStage.tsx`, `PointAnswer.tsx`, game stage styles | B/L: all-play point actual flow at 1296–1366×884 and short screens; assert image and text inside background, no dock intersection, reachable controls; use 5 root fix only if verified. | Accepted unchanged; root and independent QA approved |
| 24 | `QuestionContent.tsx`, `validatePackage.ts`, `packageDraft.ts`, `QuestionPreview.tsx` | U/B/L: text→number→text retains hidden answers and target, save/reopen/publish, preview and reveal/reconnect. Resolve `noAnswer` warning and target-as-reveal boundary described above; report any needed backend change before edits. | Accepted; root and independent QA approved |
| 25 | `QuestionContent.tsx`, `useQuestionForm.ts` | U/B: move reveal timing next to answer content/media; preserve 13/16 validation, disabled fallback value, keyboard order and scroll/focus. | Accepted; root and independent QA approved |
| 26 | `game/play/SpecialStages.tsx`, locales | B/U: identify redundant price explanation in actual stage and remove only that paragraph; retain price/actions and shared preview/live behavior, remove only truly unused locale keys. | Accepted; root and independent QA approved |
| 27 | `playtest/PlaytestSession.tsx`, `PlaytestControls.tsx`, `previewRuntime.ts`, `previewSpecial.ts`, `previewFinal.ts`, `playtestKeyboard.ts` | U/B: enact actor model above; exercise simple/hidden/choice/secret/stake/all-play/final as each role, valid player selection, no duplicated picker, no hidden answer submission, restart/pause/keyboard. | Accepted; root and independent QA approved |
| 28 | `game/play/question/AnswerReveal.tsx`, `AllPlayStages.tsx`, `game/reducer.ts`, locales | U/B/L: wording + actual submitted value by authoritative event/review; regular vs simultaneous privacy, manual and auto, reconnect. Escalate missing persisted data instead of substituting canonical answer. | Accepted; root and independent QA approved with documented evidence limits |
| 29 | `AnswerReveal.tsx`, `game/play/dock/questionModels.ts`, `game/selectors.ts`, locales | U/B/L: all-play mixed auto/manual accepted, several correct, zero point/negative score, empty/wrong and reconnect. Derive from authoritative `allPlay.entries`, normal from actual result, no score-sign guesses. | Accepted; root and independent QA approved |
| 30 | `question-form/useQuestionMedia.ts`, `useQuestionForm.ts`, `QuestionMediaList.tsx`, `QuestionForm.tsx`, `media-editor/SingleMediaField.tsx` | U/B: delete image→Ctrl/Cmd+Z restores same occurrence/point/media; add/edit and question/answer lists; inputs retain native undo, nested dialogs/cancel/focus safe. Remove button only after scoped undo works. | Accepted; root and independent QA approved |
| 31 | `QuestionStage.tsx`, `AnswerChoices.tsx`, `questionStyles.ts`, `PlaytestSession.tsx`, locales/shortcut guide | B/L: long mixed choices and option media at reported sizes/short height; assert stage bounds, dock gap, visible/reachable all options; verify independently after 5. | Accepted; root and independent QA approved |
| 32 | `useAnswerChoices.ts`, `AnswerChoices.tsx`, `game/reducer.ts`, `game/protocol.ts`, server socket/domain and OpenAPI contract | U/B/L: wrong selection visible/disabled for another player, keyboard and new question; reconnect and identical/image-only options. Inspect authoritative attempt identity and legacy limits. | Accepted; root and independent QA approved |
| 33 | Choice authoring/draft and archive, package API/persistence, `AnswerSubmittedUseCase`, preview and shared game UI | U/B/L: clicked text/media choice auto-checks; intentional spoken/text remains manual; trace explicit correctness key, privacy and legacy behavior. | Accepted; root and independent QA approved |
| 34 | `dock/JudgeExtras.tsx`, locales, existing UI/preview and live E2E tests | U/B/L: single skip zero uses existing `answerType: skip`, result/score, eligible next player, single-answerer, exhaustion/stats/undo; ensure preview retains skip classification. | Accepted; root and independent QA approved (`c4d5df95`) |
| 35 | `ui/Field.tsx`, `styles.css` | B: select arrow vs long text at desktop/mobile, focus and all locales; preserve native behavior, sizing and listbox/forced-colors fallback. | Design approved; implementation in progress |
| 36 | `features/upload/UploadAccess.tsx`, `features/auth/discord.ts`, `LoginPage.tsx`, icons/locales | U/B with mocked provider: guest already has configured-provider button; add existing Discord branding/icon, distinguish loading/error/unavailable and preserve `/packages/upload` return. Test unauthenticated/guest/configured/unconfigured, no actual OAuth. | Planned; not released |

### Current source observations

- At the planning snapshot, item 1's player was shared through `AttachmentPreview` in question media, inspector/read-only `QuestionPreview` and `media-editor/SingleMediaField`; its old `flex-wrap` put fullscreen after volume. Any layout change must keep fullscreen requested on the container so custom controls stay available.
- In 24, save eligibility (`useQuestionForm.canSave`) covers duration; `validatePackage` and serialization have separate responsibilities. Never treat the presence of a number as evidence that the public reveal has it.
- In 29, all-play `prepareAnswerReveal` clears `answeredPlayers` but does not clear `allPlay`; `backToChoosing` clears it. Confirm the real rejoin DTO and role projection before basing results on this evidence.
- For 28/32/33, the user approved a bounded server/API scope; detailed design and item-specific release remain required. For 34, protocol support for `skip` is evidence, not proof that every UI/preview/statistics path is equivalent.

### Scoped design for 32/33 — user-approved boundary, item release pending

The current editable `DraftChoiceOption.id` is local to a draft (`fromUpload` generates new IDs), while the socket `ChoiceAnswer.id` is optional and database IDs may not be emitted. Both include `order`, which is part of a published question and does not change during that question. The editor's correctness radio is derived solely from matching a **nonempty** option text to `answerText`; selecting an image-only option writes an empty string, so no correct option identity exists to recover. Duplicate text is also ambiguous. `ChoiceAnswerLogic.check` uses only normalized text, and current result/snapshot data has no submitted option identity. Thus merely sending an index for an image-only pick cannot tell the server which option is right.

Approved boundary to refine with root before item-specific implementation:

1. Add optional **published correct choice order** to the choice question's authored data, kept private like the right answer until reveal and persisted/round-tripped through authoring, storage, .oq/import/export, API and showman projection. Keep existing `answerText`/`rightAnswers` semantics for legacy packages; derive the old text when a unique text answer is selected if compatibility requires it. An explicit order must identify an existing option, with duplicate text/image-only options handled unambiguously; edits/reorder/delete must follow the selected option rather than silently point at a different one. Audit SIQ and older authoring clients before selecting migration behavior. No correct order may be exposed to player/spectator before reveal.
2. Extend `answer-submitted` additively with an optional selected **option order** while retaining `answerText` for older clients and spoken/manual answers. Server validates the order against the current question, uses the stored correct order when available, otherwise retains existing text-based automatic/manual fallback. Unknown or malformed identity must not be guessed; duplicate legacy text without identity must be handled according to a reviewed compatibility decision. The selected identity must be tied to the correct question/answering player and processed by the existing action executor.
3. Retain submitted answer and selected identity in existing current-answer state and result/answeredPlayers history; expose **only publicly revealed wrong option orders** on a server-confirmed wrong result; include them in the result broadcast and rejoin snapshot so other eligible players see a rejected option and cannot select it. Clear on new question/round and define undo/skip semantics. Do not disclose the correct order or pre-reveal simultaneous submissions. Server must enforce any intended prohibition too; a client-side disabled button alone is not a game rule. Keep older events/clients valid, and ensure absent new fields degrade gracefully. Avoid persisting private unreviewed final/all-play answers or adding extra information to their early events.
4. Mirror only the approved event/state behavior in preview. Focused evidence: text and image-only options, duplicate text and numeric collision, reordering/deleting selected option, invalid/stale order, correct/wrong/skip/undo/exhaustion, two players, late join/reconnect and next question, empty/legacy packages and import/export round trips; exact no-early-leak assertions for player/spectator plus all-play/final. Run server policy/schema/unit and actual HTTP→DB→socket tests plus React component/browser and live-game tests in an isolated owned stack. Flutter/generated Dart remain untouched unless separately authorized; specify how older clients/packages behave.

The user approved this bounded server/API scope, not a final design or immediate implementation release. Reuse existing answer/result history and lifecycle; avoid a parallel rejected-order collection unless necessary. Verify legacy packages, correct-answer secrecy, reconnect and undo before implementation. Item 34 remains a separate existing-`skip` proof and does not depend on this proposal.

### Annotation 1 acceptance

Root approved the six-file diff SHA-256 `0BF94FC34128773C4FC2A707B53EC34247F84FE633AFC2D6C94C880516A5BCED`. Typecheck, lint, focused unit and native-browser tests, changed-file Prettier and diff check passed. Independent QA: `C:/Users/diazo/.codex/visualizations/2026/10/27/01a17df4-75d8-7050-8e03-8ef87aff8485/annotations-71a6eab/ITEM-01-QA.md`. Explicit fullscreen exit and focus passed in card and inspector; Escape was inconsistent in headless Chromium, so cross-browser Escape behavior is not established. Items 7 and 8 remain pending separate acceptance.

### Annotation 2 acceptance

Root approved final patch SHA-256 `5CA2666409979642FC104FEEB2348032804C4BC31E26AA708C067177C220F671`. Independent QA approved the same runtime with the earlier test-only revision: `C:/Users/diazo/.codex/visualizations/2026/10/27/01a17df4-75d8-7050-8e03-8ef87aff8485/annotations-71a6eab/ITEM-02-QA.md`. Focused native-browser geometry at all three widths, staged deletion, Ukrainian labels and 44px target passed; typecheck, lint, Prettier and diff checks passed. Audio and image rows remain separate acceptance items.

### Annotations 3 and 4 acceptance

Root accepted both on shared commit `d9ebf495` after independent audio and image QA, including playback, fractional image duration persistence and occurrence-specific removal. No separate source changes were needed. QA evidence: `C:/Users/diazo/.codex/visualizations/2026/10/27/01a17df4-75d8-7050-8e03-8ef87aff8485/annotations-71a6eab/`.

### Approved scope for annotations 28, 32 and 33

The user approved a narrowly scoped server/API extension for items 28, 32 and 33; release and review remain item-specific. The approved scope preserves actual submitted answers and optional selected option identity in existing result/history and current-answer state, plus optional authored correct option order for image-only choices. Legacy compatibility, correctness secrecy, simultaneous/final filtering, undo and reconnect require review. Design review and item-specific release remain required before implementation. Flutter remains out of scope.

### Annotation 5 acceptance

Root approved the candidate SHA-256 `06BDB2917B76AF245536D21AE64558313CB5F287FB8C7A109DC52A3B48670E5D`. Independent simulator image/video QA and strengthened native-browser stage containment and scroll reachability passed; evidence: `C:/Users/diazo/.codex/visualizations/2026/10/27/01a17df4-75d8-7050-8e03-8ef87aff8485/annotations-71a6eab/candidate-item5.log`. The unchanged live GameScreen UI fixture has a sticky dock that overlaps long text initially; max-scroll makes text readable. Strict live non-overlap was not established, and no live layout redesign was made.

### Annotations 6 and 7 acceptance

Root accepted podium containment on `34d3e0b1` after finished-game visual QA, and the inspector video controls on the unchanged shared player from `d5060ba0` after separate evidence review. Audio remains item 8 until its seek behavior and independent QA are accepted.

### Annotation 8 acceptance

Root approved the candidate SHA-256 `FF7D4AA562CBB4A6FF56833E135F43EA7B32275CF7CE92481412AFF0F9F53B43`. On a 130-second WAV, the earlier paused keyboard seek intermittently reverted to zero (2 of 3 isolated runs); after synchronizing the controlled position with the requested seek, the same scenario passed 5 of 5 runs and independent QA passed 3 of 3 plus end/midpoint and video checks. Focused unit/browser, typecheck, lint, Prettier and diff checks passed. These repetitions do not prove every browser race eliminated.

### Annotation 9 acceptance

Root approved patch SHA-256 `2EFC7D67DE872FC127B09F8CCCF44F3FC1D35F30B988C47225C544516CA98765`. Existing answer-mode settings were moved before question media; isolated wide and narrow checks retained unsaved text, numeric answer, image target and media. Existing deviation reset on mode change is unchanged. Independent QA and focused existing tests passed.

### Annotation 10 acceptance

Root approved patch SHA-256 `59F9D903A2F62D28622D084EB8B6D454E0EBE01ED6F281BF60B0BC89F145704D`. Independent QA and full screenshots confirmed the approximately 20/80 row, narrow stacking, full-width final comment, field state and existing validation. Existing QuestionDialog tests, typecheck, lint, Prettier and diff checks passed.

### Annotation 11 acceptance

Root approved patch SHA-256 `5C1DB376E4255E46955941EAB9FAE01EA99E1CC48BAE884A48E6A08F24F51982`. Independent QA confirmed wide and narrow geometry, aligned controls, full-width dependent number/point settings and choice text, and preserved focus and draft state. Existing focused tests, typecheck, lint, Prettier and React Doctor passed.

### Annotation 12 acceptance

Root approved patch SHA-256 `BA8B7059CB3CE245A87FC20A90968901DD90155B4EF71F3587D53C8BAACC2F72`. Independent QA verified standard, final and choice layouts, multiline answers, hint and save/reopen. The previously stored showman hint is now editable for choice questions as well. Existing focused test coverage was extended for this behavior.

### Annotation 13 acceptance

Root approved patch SHA-256 `2E5F50B1F2B5752F5AC06D063E82DBA19D1AE3FD5A7A46031936177626084D16`. Independent QA confirmed the disabled styling and description, stored 60-second fallback through reload, revalidation on last media removal, cancel/discard and valid fractional save. The existing validation behavior remains unchanged; duplicate help/error is item 16.

### Annotation 14 acceptance

Root approved patch SHA-256 `1D6EB229E6FA80F9DBEABC48E070BF1E44E0ED12AA68FA8D6E3DC6074837C4AC`. Independent QA checked the semantic separator before answer sections for normal, choice and final questions on wide and narrow layouts. Existing checks passed.

### Annotation 15 acceptance

Root approved patch SHA-256 `5BFC3583399A105CA6483C4A41C5011B4A11072AF39FDFCB83C222D109C56C55`. Independent QA and full screenshots verified the attribution divider in normal, choice and final forms on wide and narrow layouts; focus and entered authors survived resize and save/reopen.

### Accepted item commit map

| Items | Approved implementation commit |
| --- | --- |
| 1, 7 | `d5060ba0` |
| 2–4 | `d9ebf495` |
| 5–6 | `34d3e0b1` |
| 8 | `b06ef867` |
| 9 | `fda94ab9` |
| 10 | `ead0d7ff` |
| 11 | `fb19cfe3` |
| 12 | `89e6a9ba` |
| 13 | `9bf5f277` |
| 14 | `5ef18ddb` |
| 15 | `438890d6` |
| 16 | `ae275d76` |
| 17 | `37ac24f1` |
| 18 | `329e21dc` |
| 19 | `101af804` |
| 20 | `43f830e7` |
| 21 | `6010e6a9` |
| 22 | `cceccb97` |
| 23 | No new runtime change; verified after `cceccb97` |
| 24 | `76a8bad2` |
| 25 | `fe0ee7ea` |
| 26 | `ada7baad` |
| 27 | `45a5f0cd` |
| 28 | `4ddd6c6f` |
| 29 | `7f051fa9` |
| 30 | `c67cd9f4` |
| 31 | `1c3525fd` |
| 32 | `940f9701` |

### Annotation 33 proposed design and reproduction

In the item 32 isolated preview an image-only option submitted the display placeholder `1`, remained in answering, and required the host's manual `Wrong −100` ruling (`item32-image-debug.cjs` and `item32-image-*` screenshots). The authoring radio currently stores only `answerText`; for an image-only option this is empty. Neither the public option list nor the current server's `ChoiceAnswerLogic` contains an authoritative correct image identity. The item 32 identity confirms which option was clicked, but deliberately leaves that case manual. This preview reproduces the reported path; it is not candidate browser/API evidence.

**Authoring and archives.** Add optional `correctChoiceOptionId` to the browser draft, pointing to the existing stable option `id`. Selecting a radio, including an image-only row, sets this id; selection survives text/image edits and reorder. Removing the selected row clears it and prevents accidental reassignment; changing away from choice preserves the hidden draft selection and emits no choice key for other types/final, while switching back restores it if the option still exists. A duplicated question/theme must remap the selected id to the corresponding cloned option. Existing stored drafts with no field remain legacy; never migrate them solely from a text match or silently turn their multiple accepted text answers into one choice. A uniquely matching old text can be indicated as legacy in the editor until the author deliberately selects a row, without inventing a persisted identity. Distinguish legacy absence from an explicitly cleared selection in draft state (for example undefined versus null): after deletion, require an author choice before publishing instead of silently falling back to some other option with matching old text. For an explicit selection, keep the existing text-answer editing semantics for text options, preserve independently authored answer media and `rightAnswers`, and define image-only selection/reveal copy without requiring a synthetic answer string. Update validation/help so a valid selected image-only answer is complete; missing/invalid selections remain editable with a clear existing-style warning or error according to publication risk, not an invented text requirement.

On `.oq` export/publication map the selected draft id to its **current** array index/order (`0` is valid), and import maps an explicit order only if exactly one source option has that order; `.oq` parse/export must preserve valid keys. Preserve legacy files with a missing or null key. A malformed, unmatched or duplicate referenced key becomes an editable unresolved selection with a diagnostic and blocks publication until the author chooses a valid option; never guess a different answer. Export an unresolved selection with an explicit archive-only `correctChoiceNeedsRepair` marker so reimport still requires repair, rather than silently converting it into legacy behavior; server DTOs omit null legacy keys. No generic raw-JSON preservation or unsafe numeric coercion is needed. SIQ import keeps its existing classified behavior and `answerText`/`rightAnswers`; do not invent an image key from unspecified SIQ semantics. Cover IndexedDB reload, save/discard, option edit/delete/reorder, clone, type switch, `.oq` round-trip and publish, plus legacy and malformed input. The current `.oq` parser and `fromUpload` regenerate IDs, and `cloneQuestion` regenerates every option id, so the id mapping must be explicit at both boundaries.

**Contract and storage.** Add optional nullable `correctChoiceOrder` to the full package question DTO, package create/replace schema and OpenAPI, with cross-field validation that an explicitly provided order identifies exactly one choice. Store it as a nullable integer column on `package_question` using a new migration and existing repository/import/toDTO pattern; legacy rows stay null and no backfill guesses from answer text. Reject a supplied key on non-choice questions, an unmatched/duplicate order, and a non-integral key that cannot be persisted in the existing integer order column. This does not widen or migrate existing choice-order columns; the current Joi package schema accepts fractions even though the database order column is integer. Update web generated API types, not excluded Flutter/generated Dart. Verify HTTP create/replace and readback with fresh and legacy packages, including `0`, nonconsecutive integers, malformed key and duplicate order.

**Authoritative grading.** For a regular choice with a valid explicit key and a uniquely validated selected `choiceOrder`, the selected order is the main correct choice; the main `answerText` no longer makes a different option with an identical label correct. Preserve the existing **Also accept** semantics: a selected text option matching an explicit `rightAnswers` alias is also correct. If no explicit key exists, retain legacy normalized text checking (main answer plus aliases), except when an orderless answer equals the one-based display number of an image-only option in the sorted list: that value could also be the legacy image placeholder, so leave only that collision manual. Unrelated numeric text choices remain automatically checked, and explicit validated order/text remains unambiguous. An explicit image-only pick without a reliable key stays manual. For a keyed question, an oral/legacy submission without a uniquely identified option, or a corrupted/unresolved key, cannot establish the selected identity and goes to manual review rather than guessed grading. This is a deliberate ambiguity fallback, not a claim that legacy clients provide image identity. Validate explicit selection membership/order/text and repeat before record/broadcast as in 32, and do not trust user-supplied text as a key. Mirror these rules in preview, replacing item 32's image-only bypass only when a valid explicit key exists. Keep score/turn/timer and the manual showman ruling path intact. Showman choice highlighting may use the key; all other roles see only authoritative wrong attempts, never the correct key.

**Reveal and secrecy.** `GameQuestionMapper.mapToSimpleQuestion` and preview `publicQuestion` are explicit whitelists; preserve them and add `correctChoiceOrder` to the `SimplePackageQuestionDTO` omission. Audit `PackageStore` current-round board projection, `question-data`, join/rejoin and preview projections so the key is absent for players/spectators before reveal, including fallback broadcasts; do not change all-play/final secrecy or rules. The current `ShowAnswerLogic` exposes authored answer text/files and builds its timer from answer files; `AnswerReveal` renders those but cannot show the selected image if both are empty. Smallest proposed reveal addition: only after reveal, include an optional selected-image URL in `answerShowData`/`question-finish` (and the preview equivalent) when the explicit correct option is image-only and there is no separately authored answer media. Render that image for the existing reveal duration, alongside any explicitly authored answer text. Leave authored answer files, their timeline/duration and text authoritative when present; do not manufacture an answer-file entry or show a key/image before reveal. The rejoin reveal snapshot retains the same optional image. Check whether an existing payload can convey this safely before adding a field; the need is the missing image itself, not an early correct-order event. This design targets regular choice only; no all-play/final rule expansion.

**Guidance and verification.** The current choice answering dock incorrectly says the showman judges every answer (`youNext`); the host guidance conversely says every clicked option is automatically scored, which is false for legacy image-only or ambiguous picks. Use localized neutral wording for both roles: the answer will be checked and may need showman review, without exposing whether a key exists. Cover all three locales and desktop/phone. Run focused editor/draft/clone/validation/archive and preview tests, real Socket.IO tests for explicit correct and wrong text/image, order zero, duplicate labels with and without aliases, spoofed payload, legacy manual image/number collision, review and reveal, plus HTTP create/replace/readback/migration and role/privacy/rejoin tests. Exercise author selects image, save/reopen, `.oq` export/import, publish and real React result/reveal where policy allows, and report separately if candidate browser/API remains blocked. Run schema validation, backend lint/build and relevant web checks/Doctor; update product/validation/compatibility docs and retain the Flutter exclusion.

Candidate evidence: an isolated Chromium editor on 375 and 1296 px selected an image-only correct option, saved the draft, waited for IndexedDB, reloaded, verified the same radio selection, played the question and saw an automatic correct result with the original image on reveal (`item33-author-image.cjs` and `item33-author-image-{375,1296}.png`). An actual `.oq` archive test round-tripped that key and media bytes. An isolated real HTTP test created a legacy package, applied the new migration to its existing rows, read it back, replaced it with key `0`, and rejected invalid replacements; the real legacy HTTP DTO was also fed to browser `fromUpload` → `toUpload`, preserving legacy state (`item33-legacy-http-dto.json`, `item33-legacy-http-to-browser.cjs`). Real Socket.IO regressions checked correct and wrong keyed images, the next player, old image/numeric collision and manual wrong without invented rejected identity, player/spectator question data and rejoin privacy, host key visibility and reveal-image rejoin. These are isolated server transport and browser preview checks, not an integrated candidate browser/API test; the latter remains blocked by the documented policy boundary.

Independent QA subsequently reproduced a real preview media lifecycle defect: changing UI language disposed the active game's blob URLs while the retained `PlaytestSession` continued using them. A role-only cycle passed; a language cycle produced a zero-width broken image and failed blob fetch. `QuestionPlaytest` now retains its launch-time player names and resource-owning preparation across language changes, while the UI's own labels still translate. Restart reuses the live resources and closing the preview disposes them. A focused component test verifies retained phase and URL through language change, reveal and restart, and one revoke on unmount. An isolated browser replay at 375 and 1296 px of QA's role and EN→UK→RU cycle verified the same option/reveal blob decodes at 120×80, fetches 502 image bytes, stays available after restart and is revoked on close (`item33-language-lifecycle.cjs`, `item33-language-lifecycle-{375,1296}-reveal.png`). Independent recheck is pending.

Web typecheck and lint passed; after the lifecycle repair, an initial full run failed once in the existing “explains manual judging” preview test because the buzz control was not found after advancing. The failure's phase was not retained in the truncated output, so a clock cause is not established. The focused file passed; the two tests that need buzz now wait for the control's actual appearance rather than assume synchronous rendering, and a repeat full run passed all 459 tests. Build and `check:api` passed; Vite retained its existing chunk-size warning. API schema validation, server lint/build and the focused transport/domain/HTTP checks passed. React Doctor against `HEAD` reported 86/100 with no findings on its 30-file changed scope; scores from other item scopes are not directly comparable. Generated web API types were updated; Flutter and generated Dart were not changed. Independent QA and root review remain pending.

### Final CI follow-ups

Root inspected CI run `40699163204`, job `122853959378`, for head `940f9701`: web E2E reported 132 passed, 16 skipped, one flaky and one failed. The stale `full-game.spec.ts:105` text expectation was separately reviewed and updated in `0604be43`; current-head CI must verify it. The phone case `web/e2e/responsive.spec.ts:70` measured a board cell at 20.90625 px instead of at least 44 px on the first attempt, then passed on retry. Diagnose the actual transient cause and report evidence before deciding whether any UI change is needed; do not mask it with a speculative CSS fix or timeout. Final acceptance requires current-head CI evidence.

### Final review follow-ups after item 36

- Final point-question review shows coordinate text but lacks the image, correct target/radius and player's picked point needed for a host's manual ruling. Investigate reusing the existing point picker and coordinate parser with existing data, preserving role privacy and rejoin; report any contract gap before changing the server.
- The repair action for `choiceCorrectUnresolved` currently focuses question text instead of the correct-choice control. Route focus to an available correct-option radio, with an appropriate add-option fallback, and verify focus after the dialog closes.

### Annotation 32 design and reproduction

At `1c3525fd`, isolated editor previews at 1296 and 375 px showed that, after player 1 selected a wrong text option and player 2 buzzed, the same option remained neutral and enabled. Independent QA reproduced this in a real game against the existing old test API: another player, a reconnecting player, spectator and showman received no rejected marker, and a repeat submission was accepted. The old test API predates item 28, so its missing submitted-answer text is not evidence against the current item 32 candidate. Preview screenshots and the fixture are in `item32-baseline-*` in the task visualization folder; QA retained separate live-game evidence.

The public regular-question attempt history already carries authoritative `answerType`, survives reconnect and is removed by answer-result undo. It does not identify an option. Extend the socket command with an optional `choiceOrder`, carry the validated selection as pending server state until adjudication, and add that order to the authoritative answer-result/history entry. Derive rejected options from history entries with `answerType === wrong` and an actual order, never from score sign or the private answer key; zero-point wrong still counts, while skip does not. Reconnect uses the same history. Clear the pending selection with the submitted answer on ruling, new actor, question and reset; undo removes the corresponding history entry. Do not invent a second persistent rejected-options list.

Use the package option's actual `order`, not its sorted display index, label or numeric image placeholder. Accept finite zero, nonconsecutive and fractional numbers at the selection boundary; package validation allows fractions but the database column is integer, so this does not assert fractional values round-trip through persistence. The Joi schema does not enforce unique choice orders, although the repository rejects duplicates during save. Explicit order must resolve to exactly one option; duplicate-order coverage addresses malformed/imported/domain data, not a claim that such a new package can be persisted. Validate option membership, repeated rejection and consistency between option and supplied text before recording or broadcasting. An image-only choice remains manual until item 33 supplies a trustworthy correctness key: its display placeholder must never cause a text option to be scored. The command's optional field preserves the wire shape for legacy clients. Regular submitted text is already broadcast publicly, and pending `choiceOrder` may follow that same semantics; it is not a correctness key. No private correct answer or simultaneous/final secret is added to the public event or snapshot.

The shared React choice control derives disabled and visibly rejected options from authoritative results for players, showman and spectators. Both click and number-key paths must reject disabled options; no optimistic wrong marker is added before a ruling. In preview, carry the same identity and verdict semantics through the existing simulated result and history. The preview currently collapses skip into a boolean wrong verdict: preserve `skip` distinctly so it does not disable an option, without implementing item 34's separate UI change.

Root approved a compatibility-preserving legacy policy: associate a normalized text match only when both the matching text and its order are unique. For ambiguous text, images or order, retain legacy/manual behavior and do not invent an identity; row-level repeat enforcement cannot be guaranteed for these legacy submissions. React must safely fall back for duplicate orders rather than repeatedly sending invalid identity. No mandatory new field or Flutter change is introduced.

Verify real Socket.IO delivery to another player and a spectator, rejoin history, repeat rejection before recording/broadcast, keyboard and click, order zero/nonconsecutive and ambiguous orders, duplicate labels, image-only manual handling, forged order/text, wrong zero score, skip, manual judgment, undo, new actor and next question. Cover legacy submissions according to the reviewed policy and prove no pre-reveal correctness key escapes. Exercise candidate preview at desktop and phone and run focused backend transport regressions, schema validation, server lint/build and relevant web checks. Report integrated candidate browser/API coverage separately if the existing policy restriction prevents it.

Candidate preview at 1296 and 375 px showed the first player's wrong option marked and disabled for the next player; pressing its number left the player in the answering phase. The isolated Socket.IO test verifies the wrong identity sent to a player and spectator, persisted in game state and delivered in a spectator join and rejoin; mismatched order/text and a repeat are rejected without submitted-answer broadcast. A separate real transport case checks that a blank-text option's display placeholder cannot be mistaken for matching correct text and remains awaiting manual judgment; it does not exercise an actual image file. Domain cases cover zero/fractional orders, zero-point wrong, skip, ambiguity and undo. The focused server pipeline passed 10 tests. Integrated candidate browser/API testing is still unavailable under the documented policy restriction.

Before root review, web typecheck, lint, all 446 tests and build passed; the build retains Vite's existing chunk-size warning. Server schema validation, lint and build passed. React Doctor's item-only changed scope against `HEAD` reported 91/100 with no findings. Root then requested clearing pending order on a new `question-data` event while preserving it for a resend, extracting the shared pure placeholder helper, and small server style/test-name changes. After those changes web typecheck, lint and 69 focused tests passed; the server focused pipeline was rerun.

Independent QA found that a rejected choice with text and an image left too little width for the text on phones. The shared choice button now places the verdict below its text in a flexible column and keeps the thumbnail at its intended size. Isolated browser checks at 375 and 1296 px covered long natural text containing an unbroken word and image-only choices after a manual wrong ruling, in English, Ukrainian and Russian. The text column measured 177 px on the phone, the image stayed 48 px, no horizontal overflow was observed, and the disabled accessible label retained the localized verdict. Screenshots and geometry logs use `item32-layout-*` and `item32-image-*` in the task visualization folder. Independent QA rechecked the final candidate; root inspected the source, contracts, tests and final screenshots and approved full SHA-256 `39C5A70E8B73BAF1E3419167204D48CA296158862925AB2F04A60CE2D091DA81` and scoped SHA-256 `88E480B77CD96087D6B281EE02CD242B06F8FF8F3359786BE660C7A3B3D30F40`.

### Annotation 31 baseline

At `c67cd9f4`, the isolated real question-editor preview reached the answering phase with five or eight mixed options: long wrapping text, image-plus-text choices and an image-only choice. Question media was an image or a video. Chromium verified all choices enabled, each scrollable fully inside the modal's visible clipping area and viewport, and no choice intersecting the dock; the question media frame and text stayed inside the question region and did not intersect the dock. Image cases covered 1296, 1304, 1359, 1364 and 1366 × 884, 1304 × 600, and 375 × 884; video covered 1304 × 884, 1304 × 600 and 375 × 884. Five-option cases covered 1304 × 884 and 375 × 884; eight-option cases covered the full matrix. Representative desktop, short and phone cases additionally verified choice hit targets and that the dock itself can be scrolled fully into view. The fixture-owned browser context, per-case geometry logs, and full viewport screenshots are in `item31-baseline.cjs` / `item31-*` in the task visualization folder. Independent QA reproduced the preview geometry at desktop, short and phone sizes without finding overlap. This is preview evidence, not an integrated candidate browser/API check.

Independent QA also found no overlap in image/video cases at desktop, short and phone sizes, but confirmed that the mobile dock appears before the options while its localized instruction says “above”. Both preview and live keyboard handlers accept digits 1–9 for enabled options, so the existing “1–4” wording is also too narrow. Root approved changing that instruction to a direction-neutral “Pick an option or press its number” in EN/UK/RU and updating the shortcut guide and its source comment to 1–9, with no layout or keyboard logic change. The preview and live UI share the same dock and stage components; actual integrated candidate browser/API evidence remains unavailable under the previously documented policy restriction.

The updated instruction was checked in all three languages in isolated desktop and 375 px previews; pressing `8` in the eight-option preview submitted the eighth answer. Locale parity tests (2) and formatting passed. The shortcut guide and comment now match the existing 1–9 handler without changing keyboard logic. Independent QA confirmed EN/UK/RU at 1304 and 375 px, a single submission using key `8`, and the 1–9 game menu on the existing test API. Root approved full candidate SHA-256 `6E8F626D23244E33760E25E6E30AAA5C80D5B4740138B54FBBF3F5E54974666E` and web SHA-256 `6345B745D7487C179159498A738F487CAC651EAB355178B10678B0B72596A7B3`.

### Annotation 30 design and reproduction

In an isolated editor draft, deleting one of two identical question images reduced the list from two to one; Ctrl+Z in the question dialog did not restore it. Deleting a choice image showed `Undo media change`; Ctrl+Z did nothing and the button remained. Full desktop screenshots and the fixture script are saved as `item30-baseline-*` in the task visualization folder. The package-wide shortcut explicitly excludes dialogs; list deletion discards the point geometry undo closure, while add/edit use independent per-list one-step closures. `SingleMediaField` also serves the package-details logo, which is outside this question-form change and must retain its working existing action.

Use one most-recent **question-form media operation** shared by question media, answer media and choice images, with a targeted inverse restoring just the affected occurrence/file and applicable previous point target. Do not snapshot the whole question or revert unrelated edits. One form-scoped Ctrl/Cmd+Z handler consumes the operation only when the question dialog owns the keyboard; it ignores editable controls, composition, repeat, modifiers used for redo, the preview, media editor and nested confirmation dialogs. Keep or restore focus to a stable form control after a removed control disappears. Preserve the package-details `SingleMediaField` action when no question-form owner is present. Remove the question-form media undo buttons only when this shortcut is implemented.

Operations must be registered at the actual successful add/edit/delete, and applied against current state. A small media-only pure state transition/inverse is preferable where async multi-file acceptance or React Strict Mode makes captured arrays/indexes stale; never register side effects inside a React state updater. Preserve the affected occurrence so duplicate hashes, later timing edits and queued asynchronous media work do not remove or restore the wrong copy. Editing uses index plus original hash while the modal editor owns interaction and hides the question fields; this is not a persistent occurrence identifier. A choice-image inverse addresses the stable option ID and does nothing if that option was deleted; it must not overwrite newer option text. The point belongs to the first question image: restore its previous point only if no newer point was chosen, and clear an incompatible newer point if undo changes or removes its image. Operations on later images leave the point unchanged. The staged media map retains source/result bytes until save or cancel; undo must retain the correct reference, and save/reopen must prove its bytes remain available.

Verify last and non-last duplicate occurrence, question and answer lists, add/edit/delete (including asynchronous batch), choice image and deleted option, existing point target, another field edited afterward, Ctrl and Meta, input-native undo, composition/redo, nested media editor and preview ownership, cancel/discard, and save/reopen. Check focus and 375 px/desktop in an actual browser. Root approved the design, including clearing an incompatible newly selected point to prevent it being applied to a different image.

Candidate checks: 442 web tests passed, plus typecheck, lint, build and formatting. React Doctor `--scope changed --base HEAD` reported 90/100 and no findings in the item 30 scan. Isolated Chromium on desktop and 375 px verified question/answer/choice deletion and Ctrl/Meta undo, native text undo, preview and media-editor shortcut ownership, and save/reopen. An isolated two-file asynchronous import confirmed that one undo removes only the last accepted file and the remaining bytes persist in IndexedDB; another actual image-editor test rotated an image, undid it and verified the original dimensions after reopen. Modal editing hides the underlying question fields, which is the relevant index/hash guard assumption. Point conflicts and later-image behavior are covered by focused tests. Root reviewed source, tests and both screenshots without a blocking finding. Independent QA verified its own question/answer/choice deletion and undo with changed text and saved MD5, a first-to-second image point conflict, and cancel/discard preserving original text and bytes; it also reran adapted keyboard, nested-editor, batch and edited-image scenarios at 1304 and 375 px.

Root approved full candidate SHA-256 `0F413A5741B13A3AFC1D0A8F9C4088B890378A9A23F27F54F84D1375D6829C17` and runtime SHA-256 `137E43875CED003AD38854DB877ABF8939D6BEB69B680D01724F5D196FC661C1`.

### Annotation 29 design and reproduction

An isolated editor preview on desktop and at 375 px accepted two of three submitted answers: both players gained 200, yet the reveal reported “No one answered correctly” and the dock gave only a generic answer message. Independent QA reproduced mixed automatic and manual acceptance through the existing live test API and rejoin snapshot, including two correct zero-point results. Those API observations are against the existing test server, not the item 28 candidate server.

The all-play review events and snapshots retain `allPlay.entries` through reveal, with `isCorrect` and each entry's `scoreChange`; the server and preview conceal answers before review. Both current reveal summaries instead inspect only regular `answerResult` / `answeredPlayers`. Use one small pure selector in the existing game selectors to return the all-play correct entries based strictly on `isCorrect === true`, with all-play taking precedence even when there are no correct entries. The stage and dock use the same entries, showing each accepted player's name and own delta, including zero; when a name is missing use a localized player-and-ID fallback, and omit a missing delta instead of inventing one. Preserve the existing regular-question behavior and submitted-answer display. Wrap long names and lists on phones. Do not modify the all-play review stage or expose its answers earlier.

Distinguish no submissions from submitted answers judged incorrect. If a submitted result is still unresolved, use neutral wording rather than asserting that nobody answered correctly. Add only the necessary localized messages. Verify zero, one and multiple accepted entries, mixed automatic/manual results, zero delta, negative total score, missing player metadata or delta, stale regular results alongside all-play, unanswered versus incorrect versus unresolved, normal questions, and reset. Cover event reduction and rehydrated reveal snapshots, role visibility, desktop and phone including long/many names, and simulator/live parity. Validate candidate behavior with isolated browser and existing live test API where available; report transport/server limitations separately.

The reviewed design was implemented as React-only candidate SHA-256 `140E2FED4ECB2092933AC3AC5360A45AA5C8D6551AB1083773A09C8950D12A53` of the staged binary web diff, saved as `item29-runtime.patch` in the task's visualization folder. All 432 web tests, typecheck, lint, build and formatting passed. Candidate simulator screenshots at desktop and 375 px show both accepted players and their individual scores in the stage and dock. Independent QA passed actual live test games against the existing test API, including one and multiple correct, automatic and manual rulings, zero points, negative total scores, rejoin snapshots and long names on a 375 px display; root inspected the live phone and desktop evidence. This existing test API is not the item 28 candidate server, so it is not evidence that the item 28 candidate browser-to-server path was exercised. React Doctor's changed-branch scan reported 78/100 with 14 findings in existing package-editor files and none in the item 29 files; this scan compares the entire branch with `origin/main`, rather than only item 29. The item 29 scan using `--base HEAD` reported 93/100 with no findings; prior-branch findings still require final PR triage.

Root approved full candidate SHA-256 `1B6D5007A904D76861A13E2DC849B4CA4008576F131B478A5BAFFED0C135C23E`; the acceptance status and this approval line are the only post-approval ledger additions.

### Authorized timer repair design

The user separately authorized a narrow server fix after item 28 exposed a pre-existing timer defect. When a wrong or skipped answer, or the answering timeout, returns a regular buzzer question to `SHOWING`, restore the saved showing timer to the active Redis timer key through the existing declared timer mutations. Resume from the saved elapsed time using the existing millisecond remaining-TTL calculation and minimum, remove the saved showing key, and preserve the existing missing-saved-timer behavior. The game-action queue and existing stale-expiration guards remain in control; no direct domain Redis write or new timer mechanism is needed. The OUT pipeline applies deletes before sets.

First prove the defect with a real Socket.IO regression: an eligible second player remains, the host marks an answer wrong or skip (and separately the answering timer expires), and the saved showing timer has a known elapsed value. Verify the restored active key, bounded remaining TTL and saved-key cleanup; expire the active key using the established test helper and prove queued timer handling reveals the question once with judged answer history intact. Cover missing and exhausted saved timers and stale notification behavior at the appropriate focused level; run isolated Redis/PostgreSQL tests, lint and build. The item 30 design remains separate and no item 30 runtime work is released by this repair.

Fail-before: the real manual-ruling scenario found the active Redis timer key absent after the resumed state was saved. With the candidate, `test:pipeline` passed all three focused Socket.IO cases (manual wrong, skip and answer timeout), checking the active key, remaining TTL, saved-key deletion, Redis-triggered queued expiry, one reveal and retained submitted text. The helper accelerates expiry with `PEXPIRE`; this proves the actual keyspace notification and queued transition, not a full natural-duration wait or integrated candidate-browser/API flow. Two focused domain tests passed for missing and exhausted saved timers; a separate queued stale-expiration scenario passed. Server lint and build passed. All transport tests used the isolated test Redis on port 56390 and test PostgreSQL database, with port 3030 and the database checked before runs; the existing QA API was not switched. Root and independent QA accepted candidate SHA-256 `71B55B03FBC8DEE2306A1824472BDEA0E1A10A54F4E247B431F98353A5452C28`.

### Annotation 16 acceptance

Root approved patch SHA-256 `A412C62F97D7FB03C8D5542386F19C315218B3C059A68FEEA9CD94A8C605C124`. Independent QA verified one associated alert for invalid blank, 1.9, 31 and nonnumeric input; valid boundaries and decimal comma, plus media transitions. Existing duration test and checks passed.

### Annotation 17 approved design

Inspector width belongs to the editor shell, defaults to 360 px, and is bounded to 320–600 px and the measured space remaining after the visible outline and a 480 px main area. If the container cannot fit those minima, the existing narrow card-to-dialog behavior applies. A keyboard-accessible vertical separator and pointer capture resize the panel; width remains local to the shell. Grouped action buttons wrap when localized labels do not fit. The same shell supports read-only previews. Baseline on 1296 px: the 360 px Russian inspector had clientWidth 359 and scrollWidth 384; the last action extended 25 px beyond its right edge.

### Annotation 17 acceptance

Root approved patch SHA-256 `1DD4AEDAAABC15A6A8E0995F40D4ABDC5B79E69FB3999E083D782CF619CFED54`. Independent QA verified bounded pointer and keyboard resizing, real width, viewport and container fallback, actions and media. Read-only inspector behavior was checked with a component fixture; published-route E2E was not run at this step.

### Annotation 18 acceptance

Root approved candidate SHA-256 `86F33A2CF6F9819E46435531999A52159E520F03CE466FB2573AB9BC8A5F4970`. The shared author preview uses the first question image and existing point geometry, with a localized coordinate button for temporary or pinned target visibility. Independent QA and browser checks verified real image bounds, interaction and reset, missing data, and effective choice mode. Read-only QuestionView at 375 px was verified using a component fixture, not published-route backend E2E. React Doctor reported 88/100 with no new findings on a different changed-file scope from item 17.

### Annotation 19 acceptance

Root approved candidate SHA-256 `76BCF1685ACAF1DE2F0789EBB84CA92B00A54DAE4D15600EE00400B1468EEE91`. At a 1296 px viewport with the default inspector, the 280 px title basis forced a second row even when 252 px (English) or 192 px (Russian) remained beside the controls. At 375 px, Russian controls overflowed the 343 px header by 61 px. A smaller title basis and a wrapping control group resolve these cases. Independent QA checked geometry, controls and final/read-only behavior; the latter used a component fixture.

### Annotation 20 acceptance

Root approved candidate SHA-256 `9320784CBF3C7593C13FA8AFF2DE6084AE5C3ED144ABE32D90D090D9A68E6C37`. Existing all-play rules specify that each player submits a stake and then an answer. The in-game explanation already says both; the editor checkbox label now says both in English, Ukrainian and Russian. Independent QA verified wide and narrow layouts, label interaction and save/reopen; locale parity and formatting checks passed.

### Annotation 21 proposed design

Use the shared live/preview bid control: quick suggestions, then a 70/30 slider and input row, with submit below. The slider uses integer step 1 and updates the same draft as the input and suggestions. Preserve invalid or temporarily empty input and existing draft lifetime across pause/reconnect; clamp the thumb for display without silently submitting or rewriting an invalid draft. Disable duplicate commands during the existing pending state.

For an ordinary auction, derive allowable actions from the existing server rules: normal bids require no existing all-in and range from the greater of 1, question price and highest bid plus 1, to the lower of player score and the optional maximum price. All-in follows its separate server predicate: the player's score must meet the effective question price, exceed an existing highest bid, and respect the optional cap. The server treats a zero question price as 1; its package schema does not exclude negative prices, so all-in must not inherit the normal bid minimum of 1 for legacy negative-price data. Pass is unavailable on the first bid attempt. If an all-in already exists, only a valid all-in or pass is available. If the question price is missing from both the current question and board snapshot, do not infer that the server's price is 1; explain that bidding details are unavailable. A first bidder with no valid action waits for the server timer, which automatically places the opening price. All-play retains its existing score/price/cap calculation and the final round its positive-score 1-to-score range. No server behavior or wire contract changes.

Reproduced baseline in an isolated browser component fixture: score 50 and price 100 offered bid 100, all-in 50 and opening pass; score 1000 and cap 500 offered all-in 1000; after another player's all-in the numeric auction remained available. Focused regression coverage must exercise the server-derived boundaries, invalid/empty draft, single-value range, pending, pause/reconnect and changing bounds, plus wide/narrow real-control rendering in preview and live React. Independent QA will separately verify live transport on an isolated backend.

### Annotation 21 acceptance

Root approved candidate SHA-256 `CB28A92CB77D46528B8EDA79E9D3F023461E343FFACF7113FD2AF1EEFDE0059A`. Independent QA verified normal auction bid/pass and all-in/pass, final bidding and everyone-stakes scoring against an isolated live backend, plus pause/reconnect draft retention and editor preview at desktop and phone widths. Pending, unusual bounds, missing price and legacy zero/negative values were checked in isolated fixtures. The unaffordable opening wait message was fixture-tested; an actual zero/negative-score game proceeded directly to answering, so that particular UI was not exercised live. Focused tests, typecheck, lint and formatting passed; React Doctor reported 92/100 with no findings in the changed scope.

### Annotation 22 acceptance

Root approved candidate SHA-256 `A22231B308FD498EDA0167005E3668F482B40B04424ECC2CDD83C426370901DF`. The prepared point picker is hidden when the selected perspective can answer on the real question stage, or when the selected test player has already submitted or awaits judging. Showman, spectator and final-round fallback remain available where the stage cannot pick a point. A key on the point-answer component alone resets its local cursor when the perspective changes without remounting the question stage or media. Independent QA verified simple, everyone and final local simulator flows at desktop and phone widths, including one command per gesture. This is simulator evidence, not server verification. Focused tests and checks passed; React Doctor reported 91/100 with no findings in the changed scope. Final point questions still use the prepared picker and Continue pending the broader item 27 work.

### Annotation 23 acceptance

Root and independent QA accepted the unchanged runtime after verifying the local all-play point preview at 1296, 1304 and 1366×884, 1304×700 and 375×884. The image and long text stayed within the stage background, did not intersect the dock at inspected scroll positions, and were individually reachable by scrolling; one image gesture produced one accepted local answer. This is local simulator evidence and does not claim a new live GameScreen regression. The behavior is covered by the earlier item 5 layout change `34d3e0b1` and item 22 picker change `cceccb97`; no additional runtime change was needed.

### Annotation 24 acceptance

Numeric questions hide correct/wrong free-text fields while preserving their draft values, hint and target controls. A numeric-only copy for editor publication and local play derives the answer text from a finite target and omits stale text aliases; archives and drafts retain the original text and aliases. Choice questions keep their existing fields even if an old numeric mode remains on the draft; final questions use their effective simple type. The published game representation cannot recover hidden text when reopened from the server as a new draft, so the original draft or exported archive is needed to retain it. Direct SIQ/OQ upload remains unchanged. Previously published numeric questions with stale reveal text need republishing: the existing reconnect reveal payload does not expose the target number.

Root approved candidate SHA-256 `B34BC85587B942767DABE58CC575656EA1FE45DAA32E5B9AFA9BC9EC912177BF`. Independent QA published and played a numeric zero question against a separate backend, then rejoined and verified the revealed zero and +100 score. Draft and archive preservation were verified; this does not extend to previously published questions or change direct uploads. Focused coverage passed 70 tests, plus 8 numeric tests after the direct-upload regression was added. Typecheck, lint and formatting passed; React Doctor reported 87/100 with no findings in the changed scope.

### Annotation 25 acceptance

Place the existing reveal-duration control inside the answer-media group using component children, removing its redundant Timing heading. Keep form state and validation unchanged, including the disabled media fallback and one associated help or error message. Verify the group placement and existing duration/media regression tests, keyboard and focus, and desktop and phone layouts with an isolated editor fixture.

The isolated editor fixture showed the old control outside the answer-media group and the candidate inside it at 1296×884 and 375×884. With answer media, the stored fallback remained disabled with its existing explanation; after removal it became editable. At 1304×884 and 390×884 after resize, the entered 2.5 seconds and focus remained, Tab reached Authors, and an invalid value produced one error and disabled Save. The 21 QuestionDialog tests passed, including the legacy fallback and 2–30 second validation. Typecheck, lint, formatting and diff checks passed; React Doctor reported 90/100 and no findings in the changed scope. These are isolated editor and component checks, not live-server evidence.

Root approved the reviewed candidate SHA-256 `21F8FDACD196A506AAF0B3006C967AD1032280AADF31E7DC24D35295E76827E4`; independent QA passed against runtime SHA-256 `1EAE9A0DCD12C925D7AC13205C7010EC318E53227E2FEB8657F5EB51588AC642`.

### Annotation 26 acceptance

Reproduce the secret-question price-selection stage in isolated local preview at wide and phone widths. Remove only its extra explanatory paragraph and the now-unused English, Ukrainian and Russian price-rule keys, along with the unused Timing keys deferred from item 25. Keep the chooser heading, allowed prices and actionable dock unchanged. Verify the existing focused game and preview tests, locale consistency, typecheck, formatting and actual price selection in both layouts.

The isolated editor preview showed the redundant paragraph before the change at 1296×884 and 375×884. After removal the chooser heading, 300/500 prices and dock remained; switching to Player 2 and choosing 500 advanced to the answering stage with price 500 at both sizes. The shared stage is used by preview and live gameplay; this check exercises the local preview only. The 41 focused game/preview tests and 2 locale consistency tests passed, as did typecheck, lint, formatting and diff checks. React Doctor reported 97/100 and no findings in the changed scope.

Root approved candidate SHA-256 `0DF6EEDB96BDAC209829CD948930F5AE973B228A707302186EC261CB3BB88296`; independent QA passed both the isolated simulator and an isolated actual game, including a price selection of 200.

### Annotation 27 acceptance

On `ada7baad`, the actual isolated editor preview leaked Player 1's unsent text into Player 2's all-play and final fields when switching perspective. Independent QA reproduced the same leak for both bidding fields (137), and a simple answering phase where Continue submitted the hidden prepared `Test answer` with the real field empty. Final point questions show a separate prepared point picker rather than a native final answer. A mounted QuestionStage fixture with no content timeline and a point image also displayed that same image twice (picker plus fallback). Screenshots/logs are outside the repository; these are local preview or isolated component evidence.

Proposed phase/actions: selected player perspective owns real buzzer, answer, bid, transfer/price and final controls; showman handles reviews through actual controls, and showman/spectator see guidance to switch to an eligible player where input is required. Remove the Test player and prepared answer/point UI. Continue performs deterministic setup and clock/reveal advancement, but never submits an answer or buzzes on behalf of an unseen actor. Preserve explicit pause, restart and scoped keyboard behavior. Re-key the dock action by perspective, not the game stage, to prevent another player's unsent text/bid from appearing while preserving media and same-player pause/reconnect lifetime. For final points, use the existing point picker with `final-answer-submit`, guard eligibility, pending, pause and submitted status, hide the text-answer input for this mode, retain other question media, and preserve manual final review; do not add server autojudging. Suppress the proven no-timeline duplicate fallback when the point picker already displays the image. Verify all question families and roles, phase transitions, timer/keyboard/pause/restart, focus and media continuity, private drafts, one command per gesture, final manual review and wide/phone layouts.

Root approved the design with explicit boundaries: Continue only chooses the target question, simulates media readiness, advances to the next content/buzzer boundary, and ends reveal. Bids, transfers, price choice, theme elimination, buzzing, answers and judging use the selected perspective’s real controls; normal timer timeouts remain. Switching perspective deliberately clears an unsent local draft rather than transferring it, while same-player pause/reconnect keeps it. Final point selection replaces only the actual first ordered image occurrence, leaving other media mounted; final answers remain manually graded. The no-timeline point fallback must likewise omit only the image already shown by the picker.

The isolated editor preview exercised simple, hidden, choice, secret, stake, all-play and final workflows using real role controls, including transfer/price, bids, answers and showman review; final point screenshots cover desktop and phone, repeated images and retained video. An isolated no-timeline stage fixture verifies the point image is not duplicated. Native browser regressions passed 3/3, including desktop keyboard/manual judging and phone point answers. A natural 3.5-second clock check verified Continue becomes disabled when the buzzer opens without user interaction; component tests cover multiple boundaries and pause/resume. The complete web unit suite passed 419 tests, typecheck and lint passed, and React Doctor reported 86/100 with no findings in the changed scope. These preview checks do not alone prove live-server final behavior.

Root approved full candidate SHA-256 `0B6366D1F7927D08CFB8A84BB1F85C9000BE37DFD96E0FCAA014D8DDA5875444`; independent QA passed runtime SHA-256 `DB543A9A9D340AD2B8DF1BE477A0AA8A8B73561F7D0546A699AE268058AD2E74`, including natural/multiple clock boundaries, per-player isolation, actual Socket.IO final point submission with manual host review, and retained video identity.

### Annotation 28 acceptance

On `45a5f0cd`, regular `answer-submitted` is a queued, validated GAME broadcast but `AnswerSubmittedUseCase` returns only that broadcast for manual review, with no saved submitted text. Auto-checked number/point/choice immediately delegates to `AnswerResultUseCase`. `Game.handleQuestionAnswer` returns the authoritative result then clears the answering player; `AnsweringToShowingAnswerHandler` embeds that result in `answerShowData`, while wrong/reopened answers remain in `answeredPlayers`. Redis `GameMapper` stores the complete game-state JSON, but React `sessionFromSnapshot` initializes its transient `submittedAnswer` to null. The shared reveal shows the canonical answer and winner only; all-play/final review already carries its own submitted answers. Existing regular submission is broadcast to the game, so persisting it in the regular game snapshot retains that visibility; it must never be populated from simultaneous all-play/final submissions.

Propose an optional nullable `GameState.submittedAnswer` for the current regular answer and optional nullable `GameStateAnsweredPlayer.answerText` for its actual submitted value. On validated submission set the current value before checking; the manual branch declares SAVE_GAME alongside its existing broadcast, and the automatic branch uses its existing judging SAVE_GAME. Copy the value into the result in `handleQuestionAnswer` before clearing it. Rejoin then restores pending manual text for the showman and the result for reveal/reconnect; old snapshots/results without the additive fields remain valid. Preserve existing repeated-submit semantics, wrong/correct/skip/timeout scoring and role restrictions. Explicitly clear current text at a new answerer/question/round, forced reveal and normal reset; undo removes/reverts the relevant result without resurrecting a stale answer; test undo followed by a fresh answer explicitly. No canonical answer substitution when actual text is absent; preserve `0` as text, and do not attach an answer to a skip/timeout that never submitted one.

In React, hydrate the pending current value from the snapshot, carry the optional result text through event/reducer and preview runtime while preserving its existing pending-answer filtering, and show it labelled as the player's submission alongside the canonical answer in the shared result/reveal only when it exists. Keep all-play and final answers hidden until their existing review phase and use their existing review data. Change both `reveal.gotIt` and `dock.reveal.correct` wording in EN/UK/RU to answer correctly; the multi-result/nobody summary remains item 29, and choice identity/evaluation remain 32/33. Update server DTO, additive OpenAPI schemas/socket metadata, Web protocol/generated API if affected, game-state spec and preview model; user explicitly excludes Flutter/generated Dart changes, so report generation not run and compatibility boundary.

Verification: focused server unit coverage for manual pending SAVE_GAME, auto-check result, repeat submission, absent/null/zero values, reset/undo/skip/timeout and old snapshots; existing role/validation behavior; one real queued Socket.IO + Redis regression across pending-review rejoin, result/reveal and another rejoin with correct/wrong, plus privacy assertions for simultaneous modes in appropriate existing tests. React reducer/reveal/preview tests cover author answer distinct from actual text, no fallback, zero and old payloads; isolated actual editor and separately owned real-game browser screenshots across relevant roles and EN/UK/RU. Run scoped backend `test:pipeline`, schema/lint/build and relevant web unit/type/lint/format, native browser and React Doctor. Design approved by root.

The candidate adds optional regular current/result text to the Socket.IO game-state contract and regenerates the web API types. Existing Flutter/generated Dart files were not changed per user scope. The real queued Socket.IO + Redis test restored `0` on a pending spectator rejoin, delivered it in the correct result and reveal, and restored it on another rejoin. The numeric auto-check test retained submitted `43` rather than target `42`; the queue burst retained the final submitted text in FIFO order. Separate real transport cases confirmed all-play and final answer privacy on spectator join; the all-play case explicitly verifies SHOWING with one submitted and one unsubmitted player before asserting secrecy; domain coverage includes null/oral, zero, skip, undo and fresh answer. The complete web unit suite passed 425 tests; schema, web API generation check, backend build/lint, web typecheck/lint and formatting passed; React Doctor reported 90/100 with no findings. The isolated editor showed zero and a 255-character answer on desktop/phone, and EN/UK/RU wording.

Evidence boundary: automatic policy review rejected QA's guarded candidate-API switch without a more specific reason, and the action did not run. The candidate backend was tested through the existing isolated Socket.IO + Redis test pipeline, and the UI through isolated preview/snapshot/event tests; a browser connected to the candidate QA API was not verified. No alternate service switch was attempted.

Independent review found that after a wrong regular answer, forced or timer-driven reveal discarded `answeredPlayers`; the connected client still had it, but a rejoined client did not. The revised candidate retains regular judged attempts through the reveal while leaving all-play clearing unchanged. The forced-reveal Socket.IO regression failed before the fix and passed afterward with spectator join and undo; its authored 30-second reveal fixture keeps the phase open for the actual join and undo. A timer-trigger handler test verifies preserved text through serialization, undo and reset, and a two-attempt test verifies repeated undo order. A React rejoined-reveal snapshot test verifies the text disappears after undo.

At item 28 acceptance, the real wrong-answer-to-natural-timeout path had not been established: the then-current `AnsweringToShowingHandler` restored the showing timer in game state but deleted the active Redis timer key without rearming it. The timer-trigger handler was tested directly; this was not evidence that the missing real timer fired. The user subsequently approved a separate correction; see [Authorized timer repair design](#authorized-timer-repair-design) for its acceptance and evidence. The 425-test complete web run predates the final added snapshot regression; that focused reveal file subsequently passed all 7 tests. Independent QA passed the isolated v2 preview in EN/UK/RU; v3 changes the server history transition only.

Root approved full candidate SHA-256 `4521FBA38C56F7E81AAF8DCD75D9AB3AEADCB859348ABBB2AB89B12DE73E4078` and runtime SHA-256 `4950470461EC9CF086C283DC76F131B82452101531CC701C0C90A2CEF068B300`. Independent QA accepted source, build, preview and synthetic snapshot evidence; the policy-blocked integrated candidate browser/API path remains unverified.

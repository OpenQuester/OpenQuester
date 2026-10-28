# React editor and game preview: 36 browser annotations

Status: implementation in progress; the per-item ledger below is the current status. Starting revision: `71a6eab30b62e61c4f9e40c334ad5fca8fb3d2bf`, draft PR [#484](https://github.com/OpenQuester/OpenQuester/pull/484). This follow-up supersedes earlier acceptance only for the newly reported cases; previous checks are historical evidence, not proof these cases work.

## Ownership and boundaries

- Orchestrator/reviewer: `01a17dd2-f558-7f60-9e97-85f816942ca3`.
- Sole implementation writer: `01a17df3-6458-7223-bdce-a41d98dbc49c`, worktree `C:/Users/diazo/.codex/worktrees/d643/openQuester`, branch `codex/web-editor-ux-playtest`.
- Independent QA: `01a17df4-75d8-7050-8e03-8ef87aff8485`; read-only on production source.
- Both execution chats use `gpt-6.1-terra`, `xhigh`, with new goals and no invented budgets. Keep one existing PR, draft, without merge.
- React `web/` is the target, including the real React game where requested. Do not modify Flutter or generated Dart. The three previously approved server exceptions are historical scope, not blanket permission for new server work. Trace suspected server/contract dependencies and report the minimal necessary change before assuming broader authorization.
- Root owns this initial brief; the implementation chat owns its subsequent implementation plan and acceptance updates. Root reviews but does not implement runtime fixes.
- Preserve the dirty original `C:/openQuester` checkout. Never reset, clean, stash, switch, or mix its unrelated work.
- User's current app is `http://localhost:5173`, running this worktree; API `53000`, WSL Docker compose `oq-web-e2e`. These are now user-facing sessions/data. Do not restart, reset, seed, clear storage, modify the user's draft, or close the user's browser tab for QA. Reproduce in an isolated browser context and separate agreed test runtime where needed. HMR must not discard unsaved user work.

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

Replace separate `Correct, 0` / `Incorrect, 0` actions with one localized `Skip, 0` action. Define it using an existing neutral/pass command if available, with correct turn continuation, result classification and no score change. Do not label a correct/incorrect ruling as neutral while retaining different scoring/statistics semantics. Inspect live and preview handlers and report any server contract gap.

### 35. Dropdown arrow spacing

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
| 26 | `game/play/SpecialStages.tsx`, locales | B/U: identify redundant price explanation in actual stage and remove only that paragraph; retain price/actions and shared preview/live behavior, remove only truly unused locale keys. | Planned; not released |
| 27 | `playtest/PlaytestSession.tsx`, `PlaytestControls.tsx`, `previewRuntime.ts`, `previewSpecial.ts`, `previewFinal.ts`, `playtestKeyboard.ts` | U/B: enact actor model above; exercise simple/hidden/choice/secret/stake/all-play/final as each role, valid player selection, no duplicated picker, no hidden answer submission, restart/pause/keyboard. | Planned; not released |
| 28 | `game/play/question/AnswerReveal.tsx`, `AllPlayStages.tsx`, `game/reducer.ts`, locales | U/B/L: wording + actual submitted value by authoritative event/review; regular vs simultaneous privacy, manual and auto, reconnect. Escalate missing persisted data instead of substituting canonical answer. | Planned; not released |
| 29 | `AnswerReveal.tsx`, `game/reducer.ts`, `game/selectors.ts`, `previewSpecial.ts` | U/B/L: all-play mixed auto/manual accepted, several correct, zero point/negative score, empty/wrong and reconnect. Derive from authoritative `allPlay.entries`, normal from actual result, no score-sign guesses; frontend-only if actual event and snapshot evidence confirms entries survive reveal. | Planned; not released |
| 30 | `question-form/useQuestionMedia.ts`, `useQuestionForm.ts`, `QuestionMediaList.tsx`, `QuestionForm.tsx` | U/B: delete image→Ctrl/Cmd+Z restores same occurrence/point/media; add/edit and question/answer lists; inputs retain native undo, nested dialogs/cancel/focus safe. Remove button only after scoped undo works. | Planned; not released |
| 31 | `QuestionStage.tsx`, `AnswerChoices.tsx`, `questionStyles.ts`, `PlaytestSession.tsx` | B/L: long mixed choices and option media at reported sizes/short height; assert stage bounds, dock gap, visible/reachable all options; verify independently after 5. | Planned; not released |
| 32 | `useAnswerChoices.ts`, `AnswerChoices.tsx`, `game/reducer.ts`, `game/protocol.ts`; server only if separately approved | U/B/L: wrong selection visible/disabled for another player, keyboard and new question; reconnect and identical/image-only options. Inspect authoritative attempt identity/snapshot limitation above, escalate if data absent. | Planned; not released |
| 33 | `useAnswerChoices.ts`, `checkPreviewAnswer.ts`, `validatePackage.ts`; server `ChoiceAnswerLogic`/contract only if approved | U/B/L: click text and image-only choice incl number collision, correct/wrong, malformed spoken/manual fallback; verify actual server decision. Report missing image identity/contract before any backend edits. | Planned; not released |
| 34 | `dock/JudgeExtras.tsx`, `game/protocol.ts`, `playtest/previewRuntime.ts`, locales | U/B/L: single skip zero uses existing `answerType: skip`, result/score, eligible next player, single-answerer, exhaustion/stats/undo; ensure preview retains skip classification. Check Joi/real socket before assuming permission. | Planned; not released |
| 35 | `features/packages/PackageSearchControls.tsx`, `ui/Field.tsx` | B: select arrow vs long text at desktop/mobile, focus and all locales; adjust native select padding minimally, verify other shared selects. | Planned; not released |
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

The user approved a narrowly scoped server/API extension; implementation is not yet released. The approved scope preserves actual submitted answers and optional selected option identity in existing result/history and current-answer state, plus optional authored correct option order for image-only choices. Legacy compatibility, correctness secrecy, simultaneous/final filtering, undo and reconnect require review. Design review and item-specific release remain required before implementation. Flutter remains out of scope.

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

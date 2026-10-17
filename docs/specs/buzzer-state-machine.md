# Buzzer state machine spec

This spec defines the product behavior expected from the answer/buzzer button. It does not claim all states are fully implemented yet. Use it when changing `GameQuestionScreen`, answer actions, keyboard shortcuts, sounds, haptics, or false-start behavior.

## Why this matters

The buzzer is the emotional center of the game. If a player does not understand whether the button was locked, ready, pressed, missed, or rejected, they lose trust in the game.

Fairness is not only server ordering. It is also visible feedback.

## State model

| State | Meaning | Player UI | Input behavior | Feedback |
|---|---|---|---|---|
| `Locked` | Question is visible or loading, but buzz is not yet allowed. | Button disabled/locked with reason. | Early press is rejected locally or by server. | Soft fail feedback; copy explains when it opens. |
| `Ready` | Player is eligible and may buzz. | Button prominent, active, keybind visible. | Press/click/tap submits answer action. | Immediate local pressed feedback. |
| `PressedPending` | Local input sent, waiting for server result. | Button shows pending/pressed state. | Prevent duplicate spam. | Optional soft tick/loading; no repeated fail sounds. |
| `PressedAccepted` | Server selected this player to answer. | Active answerer prompt. | Player answers; others wait. | Success sound/haptic/visual if enabled. |
| `Missed` | Another player was accepted first or phase changed. | Button inactive; explain missed state. | No duplicate action. | Miss/fail feedback once. |
| `AlreadyAnswered` | Player has already attempted or is exhausted for the question. | Disabled with reason. | No action. | Explain “you already answered” or equivalent. |
| `Skipped` | Player intentionally skipped/pass state. | Dotted/secondary skipped state. | Long press/toggle may unskip if allowed. | Skip/unskip feedback. |
| `NotEligible` | Player joined after question started or role/state disallows answer. | Disabled with reason. | No action. | Explain eligibility. |
| `Spectator` | User is watching only. | No active buzzer; spectator explanation. | No action. | None or gentle info. |

Implementation names may differ. Keep behavior aligned with this model.

## False-start behavior

A false start should never feel like a mysterious punishment.

Minimum behavior:

1. Locked state is visible before the user presses.
2. Early press gives one clear failure feedback.
3. UI explains: “Too early — the button opens after the question/media is ready” or equivalent localized text.
4. If false start has penalty/block semantics, show the penalty/block explicitly.
5. Do not play repeated fail sounds for key spam; rate-limit local feedback.

### Implemented rules (SIGame parity)

Per-game settings (`GameSettings`, chosen when the game is created):

- `falseStart` (default on): the buzzer opens at `gameState.buzzerOpensAtMs`
  on the SHOWING timer — after the content timeline, the reading time of a
  caption text (`QuestionContentPlanLogic.textDuration`) and, for choice
  questions, `showDelay`. The package's `answerDelay` is not used here: editors
  default it to 5 s and label it an answer window. A press before that is a false start: the server broadcasts
  `buzzer-false-start { playerId, lockMs }`, records the lock in
  `gameState.buzzerLocks`, and rejects that player's presses with
  `buzzer_locked` for 3 s. With `falseStart` off the buzzer is open from the
  start (the question timer still covers the content).
- `buttonPressMode` (default `random_within_window`): the first press in time
  opens a 300 ms accept window (`gameState.buzzerWindow`). Everyone who presses
  inside it takes part in a random draw when it closes; the winner is announced
  with `question-answer`. `first_wins` gives the answer to the first press the
  server receives.
- A designated answerer (stake/secret winner) answers on press, without these
  rules. Pausing drops a pending window; players press again after the pause.
- The showman can open the buzzer early (`buzzer-open`, no input, SHOWING
  only): `buzzerOpensAtMs` moves to the current timer position, running
  false-start locks are lifted and everyone gets `buzzer-open { buzzerOpensAtMs }`.
  The content keeps playing. It changes nothing when the buzzer is already open.

Server: `BuzzerLogic`, `QuestionAnswerUseCase`,
`TimerExpirationService._resolveBuzzerWindow` (the window rides on the active
timer key, so a pause or expiry needs no extra timer). Web: `buzzerOpensIn`,
`buzzerLockLeft`, `useBuzzer`; the Dock shows "Wait for it…" before the buzzer
opens (still pressable, so spamming is penalised), with the reason under the
button, and a lock countdown after a false start. The showman's dock has
"Open buzzer now" while it is closed. Once the content has played, the stage
shows a "The buzzer is open" card with the time left, so it is never empty.

Flutter: reads `buzzerOpensAtMs` from question data and media status, shows the
waiting state before the buzzer opens and a countdown while a false-start lock
runs (`buzzer_timing.dart`, `game_question_screen.dart`), and blocks presses
during the lock. `buzzer-open` replaces the opening deadline and clears both
the snapshot's locks and the local false-start countdown without restarting
content. Choice options use the server content deadline when positive and the
content timeline plus package `showDelay` when false starts are off.
Pausing freezes that delay; the answer timer does not hide
already available options.

## Input methods

Supported/expected input surfaces:

- mouse/touch primary button
- keyboard default: Space and/or Enter depending on final product decision
- mobile large touch target
- future custom keybinds with persistence
- future mobile haptic success/fail feedback

Do not add a new shortcut without:

- showing or documenting it in UI/help/settings
- checking conflict with text fields and showman controls
- avoiding repeated submits while pending

## Server authority

The client may show optimistic local feedback, but the server decides the accepted answerer through queued game action ordering.

Backend invariants:

- answer actions that mutate game state go through `GameActionExecutor`.
- server checks role, phase, eligibility, skipped/already-answered state, and current answering player.
- server broadcasts authoritative accepted/missed/phase changes.

Frontend invariants:

- local pressed state must reconcile with server state.
- pending state must recover if server returns error or socket reconnects.
- UI must avoid implying the user won the buzz until server confirms.

## Sounds and haptics

Sound/haptic behavior should be short, clean, and optional.

Suggested categories:

- `button-success` — player was accepted first.
- `button-fail` — locked, missed, or not eligible.
- `answer-correct` — showman marked correct.
- `answer-wrong` — showman marked wrong.
- `phase-change` — important game phase transition.
- `timer-warning` — last seconds, used sparingly.

Rules:

- Provide settings to disable UI sounds when implemented.
- Avoid casino/mobile-gacha style noise.
- Avoid playing many fail sounds during key spam.
- Do not make sound the only feedback channel.

## UX copy requirements

Use localized short messages. Examples are conceptual, not final copy:

- Locked: “Button opens after the question is ready.”
- Waiting media: “Waiting for everyone to load media.”
- Ready: “Press Space to answer.”
- Pending: “Submitted…”
- Accepted: “You are answering.”
- Missed: “Someone was faster.”
- Already answered: “You already tried this question.”
- Spectator: “Spectators cannot answer.”

## Test scenarios

When implementing this behavior, test at least:

- player presses while locked
- player presses when ready
- two players press nearly simultaneously
- accepted player disconnects/reconnects
- player joins after question started
- player already answered wrong and tries again
- spectator tries to answer
- mobile/touch path if changed
- shortcut does not trigger in text input fields

## Files likely affected

Frontend:

- `client/apps/client/lib/src/features/game_question/view/game_question_screen.dart`
- `client/apps/client/lib/src/features/game_question/controllers/game_question_controller.dart`
- `client/apps/client/lib/src/features/game_lobby/controllers/game_lobby_controller.dart`
- localization JSON

Backend:

- `server/src/presentation/controllers/io/SocketActionMap.ts`
- answer-related game action handlers/use cases
- `server/src/domain/entities/game/Game.ts`
- answer/phase validators and DTOs
- `openapi/schema.json` if public payload changes

## Done when

A buzzer change is done only when:

- state is clear before and after pressing
- disabled reason is visible
- keyboard/touch behavior is intentional
- server authority is preserved
- localization is updated
- relevant tests/checks are reported

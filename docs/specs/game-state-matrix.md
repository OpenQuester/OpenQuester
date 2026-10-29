# Game state matrix

This spec helps agents keep gameplay UI and backend state changes aligned. Update it whenever a phase, role permission, CTA, disabled reason, timer, or user-facing state changes.

Status note: this is a product behavior target and maintenance matrix, not a claim that every row is fully implemented today. Verify current code before marking a behavior as done.

## Core rule

For every visible game phase, each role should know:

- what is happening
- what they can do
- why they cannot do something
- what timer/wait condition matters
- what feedback confirms the result

## Roles

| Role      | Meaning                                                                                 |
| --------- | --------------------------------------------------------------------------------------- |
| Showman   | Host/controller. Chooses questions, controls flow, marks answers, manages lobby/game.   |
| Player    | Competes, buzzes/answers, bids, eliminates final themes, sees role-specific prompts.    |
| Spectator | Watches game state without gameplay actions. Should still understand what is happening. |

## High-level phases

While choosing, the dock offers **Pick random question** to the showman and any
player currently allowed to pick on the board (including its unknown-turn
fallback). It samples uniformly from unplayed cells in the current round and
sends the existing `question-pick` command. Pending, disconnected and stale
phase/turn states cannot send another pick; an exhausted board explains that no
questions remain. Skip round remains in showman tools, outside the dock.

Names in code may differ. Use nearby enums/types as the implementation source of truth, but preserve this product behavior.

| Phase                   | Showman primary CTA                                   | Player primary CTA                         | Spectator primary CTA                                   | Disabled reason examples                                                                 | Feedback                                                                                 |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Lobby                   | Configure/start game                                  | Ready/unready, choose slot/role if allowed | Join/watch                                              | “Waiting for players”, “Waiting for the showman” in manual mode, “Package missing”       | selected start mode, ready state, showman slot, package rounds/themes, copied link toast |
| Choosing                | Choose a cell or random question                      | Choose if it is your turn; otherwise wait  | Watching choice                                         | “Only showman/current player can choose”, “Question already played”, “No questions left” | chosen cell highlight, phase transition                                                  |
| Media downloading       | Observe preparation; showman readiness does not block | Prepare media, then report readiness       | Observe preparation; spectator readiness does not block | “Waiting for media”, “Waiting for active players”                                        | media timer, per-player readiness; content should remain gated                           |
| Showing question        | Continue/watch question                               | Wait until buzzer ready                    | Watching question                                       | “Button locked until question is ready”, “You joined after question started”             | question timer, role-aware controls                                                      |
| Ready to buzz           | Observe/prepare to judge                              | Press buzzer                               | Watching who buzzes                                     | “You already answered”, “You are skipped”, “Spectators cannot answer”                    | Ready state, keyboard hint, pulse/sound when active                                      |
| Answering               | Mark correct/wrong/skip                               | Answer if selected, otherwise wait         | Watching active answerer                                | “Another player is answering”                                                            | active player highlight, answer prompt                                                   |
| Reviewing answer        | Correct/wrong/score result                            | Waiting for showman decision               | Watching review                                         | “Only showman can mark answer”                                                           | score delta, correct/wrong result, next phase                                            |
| Between questions       | Pick next / next round                                | Waiting                                    | Watching                                                | “Round is not ready”, “Game paused”                                                      | phase label, next action visible                                                         |
| Final theme elimination | Eliminate for current player / observe                | Eliminate if it is your turn               | Watching elimination                                    | “Not your turn”, “Theme already eliminated”                                              | eliminated theme animation, next player indicator                                        |
| Final bidding           | Observe / proceed when bids complete                  | Submit bid if eligible                     | Watching bids                                           | “Bid already submitted”, “Insufficient score”, “Spectators cannot bid”                   | bid submitted state, timer, all-bids-ready state                                         |
| Final answering         | Wait/review later                                     | Submit final answer                        | Watching answer phase                                   | “You did not bid”, “Answer already submitted”, “Timer expired”                           | submitted state, remaining time                                                          |
| Final reviewing         | Review each answer                                    | Waiting for review                         | Watching review                                         | “Only showman can review”                                                                | per-answer correct/wrong, final score updates                                            |
| Finished                | Start/rematch/share/admin actions                     | See results/rematch/share                  | See results                                             | “Game already finished”                                                                  | winner, podium, summary, score deltas                                                    |
| Paused/reconnecting     | Resume or wait                                        | Reconnecting/waiting                       | Reconnecting/waiting                                    | “Game paused”, “Connection lost”                                                         | reconnect banner, restored state                                                         |

Final questions with non-null `textItems` use a server-provided `contentPlan`:
eligible players preload files (up to 30 seconds), then watch the sequence before
answering. Timeout starts playback with a persistent media warning. Pause and
rejoin preserve progress; reconnecting players preload again. New players and
spectators do not block readiness. A disconnect during preparation does not
forfeit an eligible player's answer while its answering window remains open.
Every committed final bid is settled; an unanswered bid loses at the deadline
even if its player remains disconnected.
Null/absent `textItems` preserves legacy behavior. Flutter does not yet support
the new sequence or preparation acknowledgement, so mixed games may reach the
timeout. See [package validation](package-validation-spec.md) for duration rules.

## Required frontend behavior

### Lobby and question layout

`settings.autoStart` defaults to `true`: a ready command starts play when all
connected players are ready. Manual mode requires the showman's `start`; the
showman can start in either mode without readiness. Leaving the player role
clears readiness. The lobby package overview reads published metadata, which may
differ from the game's snapshot after package edits.

The React field fits between header and dock; overflow scrolls within content
panels. All 15 players and the showman remain visible with full signed scores up
to `SCORE_ABS_LIMIT` (`2_100_000_000`). Tabs preserve mounted media. Previewing an
option image never selects it. Physical `KeyP` invokes Pass across keyboard
languages, excluding typing, dialogs and repeats.

Showman score shortcuts use authoritative `score-changed` with the current question
value (including stake/no-risk rules), or the last completed value while choosing.
Reconnect clears the locally remembered value; unknown values, offline/pending
state and finished games disable shortcuts. Scores never update optimistically.

### Media: current protocol vs product target

The normal regular-question wire flow is `QUESTION_PICK` → `QUESTION_DATA`
(links/content and media timer) → client readiness ACKs → `MEDIA_DOWNLOAD_STATUS`
completion and `SHOWING`. No-file questions use immediate client ACKs. The
barrier waits for connected players who were present at the pick, including
non-answerers in no-risk questions. Late joiners, showmen and spectators do not
block it. Timeout forces completion; there is no second data/reveal event.

Content hiding is a product requirement, not a claim about current Flutter.
The [media coordination reference](../../server/docs/media-download-sync.md)
records the known early image ACK and ungated text paths and owns detailed
protocol semantics. Backend transport tests do not establish this UI target.

### Per-phase checks

React shows a non-dismissible 3.5-second transition at game start and between rounds, including the final.
It skips joining/reloading an active game, respects reduced motion and does not pause play.
The React header shows the current/total round count in a neutral capsule, including
the final in the total. Hover or keyboard focus opens the animated, read-only round
list; click pins it, Escape or outside click closes it. The list marks completed,
current and next rounds, uses an SVG trophy for the final and scrolls independently
without resizing the field. Reduced motion disables the transition. If package
metadata is unavailable, the server's current round label remains visible without
an invented total. Round changes follow the live snapshot and close the old list.
React covers and disables the game field during pause while preserving its state and board-edit mode.
The showman can resume from the header or host tools; chat and permitted management remain available.
Join retries preserve drafts and errors with busy buttons; masked passwords have a visibility toggle.

React answer/bid drafts survive pause and temporary reconnect, while controls
remain unavailable until the game resumes. Pending/accepted answers prevent
duplicate sends; rejection or timeout allows a manual retry. Timed final/all-play
answers make at most one automatic attempt and never auto-send while paused/offline.
Space preserves the native action of a focused control; modal dialogs suppress
game shortcuts. Another-tab takeover uses a native modal with explicit choices.

When changing gameplay UI, make sure the affected phase has:

1. Role-aware primary action.
2. Clear disabled reason for unavailable actions.
3. Visible timer or waiting condition.
4. Immediate local feedback for user actions when safe.
5. Server-confirmed feedback when authoritative result arrives.
6. Mobile and desktop input affordance if the action is time-sensitive.
7. Localization keys for user-facing text.

## Required backend behavior

`GET /v1/games` accepts optional `status=lobby|playing`, combined with title,
privacy and date filters before pagination and the reported total. Lobby means
neither `startedAt` nor `finishedAt` is set; playing means `startedAt` is set and
`finishedAt` is absent, including paused games. Finished games match neither.
Omitting `status` retains the existing listing of every status. The filter reads
current lifecycle fields in bounded batches, without a persistent status index
or additional writes on gameplay saves.

When changing gameplay state, make sure:

1. Game-changing actions go through the queued `GameActionExecutor` path.
2. Domain rules live in `domain/` when reusable or non-trivial.
3. Use cases return declared mutations instead of hidden writes/emits.
4. Broadcast payloads let the frontend distinguish role/phase/disabled states.
5. New public event/payload changes are reflected in `openapi/schema.json`.
6. Tests cover invalid roles, invalid phases, and race-sensitive behavior when applicable.

## Rules confirmed while building the web client

- A question ends as soon as nobody can still buzz: every eligible player has
  either answered or passed. A pass after someone else's wrong answer reveals
  the answer immediately instead of waiting for the timer.
- Simple, choice and hidden-price questions reopen the buzzer with the remaining
  question time after a wrong answer, skip or answering timeout. A correct answer
  or no remaining eligible players reveals the answer. Secret, stake and
  single-player no-risk questions allow only their designated answerer.
- When the showman picks a stake or secret question, it belongs to the player
  whose turn it was: they make the opening bid or choose the recipient. The
  showman never bids, receives or answers.
- `start` carries `currentTurnPlayerId`, so every client shows who picks first.
- The showman's copy of the final question includes the answer for judging.
- Regular submitted text is public and retained through ruling/reveal/rejoin;
  oral answers without stored text remain unknown. A new answerer or question
  clears it. All-play and final answers remain private until review.
- A wrong choice ruling blocks that option for the rest of the question, even
  for zero points; a skip does not. Undo restores it, and reconnect preserves the
  history. Explicit option orders identify selections; ambiguous legacy text or
  image placeholders cannot identify a rejected option reliably. The correct
  key stays private until reveal, which includes an image-only correct option
  when no answer media was authored.

## Special question rules (SIGame parity)

- **Choice:** an explicit `correctChoiceOrder` or unambiguous text key allows
  automatic checking (+price/−price); accepted text aliases still count.
  Ambiguous legacy/image-only answers remain manual. Options appear `showDelay`
  after the content; false-start mode normally opens the buzzer then too.
  Failed sends unlock options for retry;
  pending or accepted submissions keep them locked.
- **Number and point answers** (`answerType`): a typed number is checked
  against `answerNumber` ± `answerDeviation`; a point answer is a click on the
  target picture, sent as `"x,y"` fractions and checked against
  `answerPoint` within `answerDeviation` (a share of the width, 5% by
  default). Right +price, wrong −price, no showman ruling; text that isn't a
  number / point goes to the showman. In "everyone answers" questions these
  answers are ruled when the review starts. Final points are judged manually;
  only the showman receives the private target, including after rejoin.
  `pointImageOrder` selects the image; absent/null selects the first ordered image.
  With `answerPoint.imageAspectRatio`, distance is `hypot(dx, dy / aspect)`;
  zero radius compares coordinates at three-decimal wire precision. Legacy
  metadata-free points keep their original distance calculation until republished.
  The browser preserves the image frame through input and marks submitted points
  with names at reveal; coincident labels may overlap. The target region replaces
  a separate answer panel. Correct answers appear in a local chat summary,
  deduplicated per question and rebuilt on rejoin, not persisted as server history.
  Player outlines show authoritative results: green correct, gray zero/pass, red
  wrong, retained for 15 seconds after completion plus a 1.5-second fade (no fade
  with reduced motion). Current outcomes take precedence; undo/unpass clears them,
  and manual score edits never create them. Rejoining during reveal restarts the
  local display window when the completion timestamp is unavailable.
  Reveal data retains the target image for rejoin; a local selection may be lost.
  Private coordinates/radius are not exposed before reveal.
- **Showman instruction:** the web UI places `questionComment` before question
  content for the showman, including final answer and review phases, and omits
  it from public answer reveal. This UI visibility does not make the field
  secret in the current protocol.
- **Secret, customPrice:** after the transfer, the receiver picks the price
  from `allowedPrices` (`secret-question-price`, 30 s; on timeout the lowest
  price). The question is then shown and answered at that price. On the web, the
  receiver chooses with centered stage buttons; other roles see non-interactive
  price tiles with neutral borders. The dock contains a hint, not duplicate price buttons. Pause, pending
  commands and disconnection disable the stage controls.
- **Hidden price:** the board shows the price as unknown until the question
  is picked.
- **No risk (single player):** only the player who picked the question may
  answer. A showman picking on a player's behalf uses the current turn player.
  Media readiness still includes all players. One answer or its timeout ends the question;
  wrong answers and giving up cost no points.
- **Give up or answering timeout (no risk, secret, stake):** the designated answerer's
  `question-skip` or timeout follows the normal wrong-answer ruling, including its scoring,
  answer reveal, reveal timer and return to the board. A stake loses the winning
  bid; a secret question loses its selected price.
  Delayed timer expiration notifications cannot end a newer active timer.
  Give up remains available for point-on-image answers. The regular Pass action
  is not offered before a single-answerer question enters ANSWERING.
- **Everyone answers** (stake or no-risk with `subType: forEveryone`,
  `gameState.allPlay`): no buzzer. Stake mode starts with hidden stakes from
  every player (`all-play-stake`, 30 s, at most the player's score or the
  price, capped by `maxPrice`; missing stakes become the price). The question
  then preloads and shows; every player types an answer (`all-play-answer`,
  45 s after the content). The showman rules on each answer in REVIEWING
  (`all-play-review`); a missing answer is wrong. Stake: right +stake, wrong
  −stake. No-risk: right +price × multiplier, wrong ±0. Answers and stakes
  stay hidden from players until the review.

## Showman tools

- **Remove / restore a question** (`question-remove-restore`, while choosing): the
  question's `isPlayed` flips. A removed question can't be picked; the round
  still ends only after a question is played or the showman moves on.
- **Undo the last ruling** (`answer-result-undo`, while the question is open
  or its answer is shown): the score change is reverted. After a wrong answer
  on an open question the player may buzz again. Each ruling can be reverted
  only once, including a give-up ruling during the answer reveal.
- **Who can join** (`game-join-mode-change`: open / spectators only / closed): blocks
  newcomers; people already in the game can always come back. Shown in the
  game list as `joinMode`.
- **Change the rules** (`game-settings-change`, any phase until the game
  finishes): any subset of false starts, press mode, wrong-answer penalty and
  timers, with the same limits as on creation. The server broadcasts the full
  settings and logs the change to the chat. A running timer keeps its
  deadline; new values apply from the next timer or question (false starts
  from the next question shown). The round time limit is measured from the
  start of the current round, so a shorter limit can end this round after the
  question in play.
- **Game info** (REST `PATCH /v1/games/{gameId}`, showman only): title, seat
  count (not below the players in the game) and a private game's password.
  The room hears it through the `games` feed (`changed`).

The public events `question-toggle` and `game-join-mode` were renamed to
`question-remove-restore` and `game-join-mode-change`. Their payloads are unchanged.
Update the backend and browser assets together; older browser tabs need a reload.

## Common disabled reason categories

Use consistent categories in UI copy and server/client logic:

- `wrong_role` — this role cannot perform the action.
- `wrong_phase` — action is valid in another phase only.
- `not_your_turn` — action belongs to another player/showman.
- `already_done` — user already answered/bid/readied/skipped.
- `not_eligible` — joined late, eliminated, insufficient score, muted/restricted, etc.
- `waiting_for_media` — media readiness has not completed.
- `waiting_for_server` — local action submitted, server confirmation pending.
- `rate_limited` — too many actions too quickly.
- `connection_lost` — socket/session is reconnecting.

## Agent update checklist

Update this spec when:

- adding a new phase/state
- changing role permissions
- changing answer/buzzer behavior
- changing final round behavior
- changing media waiting/reconnect behavior
- adding user-facing disabled reasons
- changing game-finished summary behavior

Do not update this matrix for purely internal refactors that do not affect visible state.

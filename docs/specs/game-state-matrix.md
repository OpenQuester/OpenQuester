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

| Role | Meaning |
|---|---|
| Showman | Host/controller. Chooses questions, controls flow, marks answers, manages lobby/game. |
| Player | Competes, buzzes/answers, bids, eliminates final themes, sees role-specific prompts. |
| Spectator | Watches game state without gameplay actions. Should still understand what is happening. |

## High-level phases

Names in code may differ. Use nearby enums/types as the implementation source of truth, but preserve this product behavior.

| Phase | Showman primary CTA | Player primary CTA | Spectator primary CTA | Disabled reason examples | Feedback |
|---|---|---|---|---|---|
| Lobby | Configure/start game | Ready/unready, choose slot/role if allowed | Join/watch | “Waiting for players”, “Only showman can start”, “Package missing” | ready state, role badges, copied link toast |
| Choosing | Choose theme/question | Waiting for question choice | Watching choice | “Only showman/current player can choose”, “Question already played” | chosen cell highlight, phase transition |
| Media downloading | Observe preparation; showman readiness does not block | Prepare media, then report readiness | Observe preparation; spectator readiness does not block | “Waiting for media”, “Waiting for active players” | media timer, per-player readiness; content should remain gated |
| Showing question | Continue/watch question | Wait until buzzer ready | Watching question | “Button locked until question is ready”, “You joined after question started” | question timer, role-aware controls |
| Ready to buzz | Observe/prepare to judge | Press buzzer | Watching who buzzes | “You already answered”, “You are skipped”, “Spectators cannot answer” | Ready state, keyboard hint, pulse/sound when active |
| Answering | Mark correct/wrong/skip | Answer if selected, otherwise wait | Watching active answerer | “Another player is answering” | active player highlight, answer prompt |
| Reviewing answer | Correct/wrong/score result | Waiting for showman decision | Watching review | “Only showman can mark answer” | score delta, correct/wrong result, next phase |
| Between questions | Pick next / next round | Waiting | Watching | “Round is not ready”, “Game paused” | phase label, next action visible |
| Final theme elimination | Eliminate for current player / observe | Eliminate if it is your turn | Watching elimination | “Not your turn”, “Theme already eliminated” | eliminated theme animation, next player indicator |
| Final bidding | Observe / proceed when bids complete | Submit bid if eligible | Watching bids | “Bid already submitted”, “Insufficient score”, “Spectators cannot bid” | bid submitted state, timer, all-bids-ready state |
| Final answering | Wait/review later | Submit final answer | Watching answer phase | “You did not bid”, “Answer already submitted”, “Timer expired” | submitted state, remaining time |
| Final reviewing | Review each answer | Waiting for review | Watching review | “Only showman can review” | per-answer correct/wrong, final score updates |
| Finished | Start/rematch/share/admin actions | See results/rematch/share | See results | “Game already finished” | winner, podium, summary, score deltas |
| Paused/reconnecting | Resume or wait | Reconnecting/waiting | Reconnecting/waiting | “Game paused”, “Connection lost” | reconnect banner, restored state |

## Required frontend behavior

### Media: current protocol vs product target

The normal regular-question wire flow is `QUESTION_PICK` → `QUESTION_DATA`
(links/content and media timer) → client readiness ACKs → `MEDIA_DOWNLOAD_STATUS`
completion and `SHOWING`. No-file questions use immediate client ACKs. The
barrier includes active players only, not showman/spectators; a timeout forces
completion without proving downloads. There is no second data/reveal event.

Content hiding is a product requirement, not a claim about current Flutter.
The [media coordination reference](../../server/docs/media-download-sync.md)
records the known early image ACK and ungated text paths and owns detailed
protocol semantics. Backend transport tests do not establish this UI target.

### Per-phase checks

React shows a non-dismissible 3.5-second transition at game start and between rounds, including the final.
It skips joining/reloading an active game, respects reduced motion and does not pause play.
React pause uses the same heading and blurred backdrop over only the game field.
The field stays mounted but inert; the pause message lasts until server-confirmed
resume, including after join/reconnect. The showman sees only the pause icon and
heading; players and spectators also see a message to wait for the showman,
including in the action dock. The showman can resume from the header or host tools;
both controls wait for the same request and disable while disconnected. Chat and
permitted host management remain accessible.
Skip question/reveal, next round (including an open confirmation) and board editing
are disabled with a pause reason. An existing board-edit mode survives pause;
this is a UI restriction only, without changing backend editing permissions.
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
- When the showman picks a stake or secret question, it belongs to the player
  whose turn it was: they make the opening bid or choose the recipient. The
  showman never bids, receives or answers.
- `start` carries `currentTurnPlayerId`, so every client shows who picks first.
- The showman's copy of the final question includes the answer for judging.

## Special question rules (SIGame parity)

- **Choice:** a picked option is checked by the server when the question's
  right answer is exactly one of the options (`ChoiceAnswerLogic`); right
  scores +price, wrong −price, and the showman does not judge. Otherwise the
  showman judges as usual. Browser image-only picks send their displayed
  option number, prefixed with `#` until it differs from every normalized
  text option, so a numeric text answer cannot be judged in its place.
  They remain manual rulings. Failed sends unlock the options for retry;
  pending or accepted submissions keep them locked.
  Options appear `showDelay` after the content, and
  the buzzer opens then.
- **Number and point answers** (`answerType`): a typed number is checked
  against `answerNumber` ± `answerDeviation`; a point answer is a click on the
  question's first picture, sent as `"x,y"` fractions and checked against
  `answerPoint` within `answerDeviation` (a share of the width, 5% by
  default). Right +price, wrong −price, no showman ruling; text that isn't a
  number / point goes to the showman. In "everyone answers" questions these
  answers are ruled when the review starts.
- **Secret, customPrice:** after the transfer, the receiver picks the price
  from `allowedPrices` (`secret-question-price`, 30 s; on timeout the lowest
  price). The question is then shown and answered at that price.
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

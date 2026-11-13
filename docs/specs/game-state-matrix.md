# Game state matrix

## Structured question scripts

A script presents one wait at a time. Content uses the authored timeline and
media readiness; `askAnswer` starts its own button or direct input window. A direct
ask with an explicitly empty eligible recipient set continues without an answer
window or award; without a recipient selection it falls back to the picker.
Transfer, price and bidding use their existing actions. Before a buzz, Pass is
neutral. The showman can reveal the current ask and stop the remaining steps;
if there is no reveal, the control says to stop the script. `accept` awards
points once without creating an answer result or incrementing answer counters.
The reveal can display the most recent correct verdict and its actual score
change across multiple asks. It does not disclose any private submission.
During an active single-player ask, the showman's **Skip ±0** closes the current
attempt even before typed input arrives. Correct and wrong rulings on typed
answers require a submission. The result is a public skip for zero points and
counts as an attempt without adding a correct or wrong answer. Any submitted
option stays in the attempt history and remains available to other players.
Button asks reopen for remaining eligible players using the remaining buzzer
time. Direct asks and exhausted button asks continue to the next script step.
The editor playtest follows the same ruling. Player give-up and timeout still
use the wrong-answer policy.
During a group ask, skipped, expired and forfeited answers have a terminal
wrong verdict. The showman reviews pending submissions, then scoring and
statistics apply once when all verdicts are known.
A select option ruled wrong is unavailable for the rest of the current button
ask. A forfeited attempt leaves its option available.
Each group member can still choose independently, and a later ask starts with
no rejected options. While the same button ask is open and awaiting a buzz,
the showman can undo its last wrong or neutral skip ruling. This restores the
applied score change and answer counters, lets the player buzz again if otherwise eligible,
and makes their rejected option available again. Undo during the answer reveal
restores the score and counters without reopening a resolved ask.

The serialized game executor saves the private cursor, actor, submitted answers,
resolved price and applied effect identities with game state. `question-script-state`
and reconnect snapshots expose the active content and safe wait. Before an
announcement, only the chooser and showman receive the current price bounds.
A late command for a different question or step cannot advance the wait. Pause
freezes its timer; reconnect restores the wait without replaying the preamble.
With single-instance startup recovery enabled, active scripted answer and price
waits and modern secret price selections resume from their wall-clock remainder.
The same applies to authored answer windows, select, normal-for-all, modern
secret answers and SIQ point answers. Recovery restores these games paused. An
exhausted clock expires immediately after unpause. Already-paused answer and
price clocks keep their saved time. Legacy clocks recover with their full duration.
The dock and group review use the same point values as the current script ruling.
An ordinary script exposes its fixed actual when its ask opens. The board keeps
the nominal price. Current select options retain their display labels. Scripted
select and editor playtest validate the submitted order and display text against
the active ask's options, including numeric placeholders for media-only options.
Personal bids appear in estimates for their owner and during review. Estimates
with unavailable or hidden amounts are omitted. Select option media uses the
same readiness barrier as authored media. A direct ask waits for its current
option files when a previous content step did not already prepare them. Only
authored timeline media contributes to duration reports.
A disconnect keeps the seat. An explicit departure during pause is remembered
and resolves the affected wait on unpause. Media acknowledgments received during
pause are checked when play resumes.

Explicit final programs choose their own preamble. Inherited finals retain native
personal bids and manual review. An already accepted native bid in a resumed
context remains private until review and takes precedence over the base price.

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
| Media downloading       | Observe preparation; prepare files when hosting solo | Prepare media, then report readiness       | Observe preparation; spectator readiness does not block | “Waiting for media”, “Waiting for active players”                                        | media/transition timers, per-player readiness; content stays frozen until release                           |
| Showing question        | Continue/watch question                               | Wait until buzzer ready                    | Watching question                                       | “Button locked until question is ready”, “You joined after question started”             | question timer, role-aware controls                                                      |
| Ready to buzz           | Observe/prepare to judge                              | Press buzzer                               | Watching who buzzes                                     | “You already answered”, “You are skipped”, “Spectators cannot answer”                    | Ready state, keyboard hint, pulse/sound when active                                      |
| Answering               | Mark correct/wrong/skip                               | Answer if selected, otherwise wait         | Watching active answerer                                | “Another player is answering”                                                            | active player highlight, answer prompt                                                   |
| Reviewing answer        | Correct/wrong/score result                            | Waiting for showman decision               | Watching review                                         | “Only showman can mark answer”                                                           | score delta, correct/wrong result, next phase                                            |
| Between questions       | Pick next / next round                                | Waiting                                    | Watching                                                | “Round is not ready”, “Game paused”                                                      | phase label, next action visible                                                         |
| Final theme elimination | Eliminate for current player / observe                | Eliminate if it is your turn               | Watching elimination                                    | “Not your turn”, “Theme already eliminated”                                              | eliminated theme animation, next player indicator                                        |
| Final bidding           | Observe / proceed when bids complete                  | Submit bid if eligible                     | Watching bids                                           | “Bid already submitted”, “Insufficient score”, “Spectators cannot bid”                   | bid submitted state, own amount only, timer, all-bids-ready state                        |
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
Null/absent `textItems` preserves legacy behavior. See
[package validation](package-validation-spec.md) for duration rules.

If a final starts with a single theme, the elimination deadline advances
straight to bidding and keeps the theme available.

## Secret preamble and award

Secret data carries an explicit optional step (`transfer` or `price`), actor and
accepted recipient. Absent fields retain legacy OQ behavior. The existing
transfer and price actions remain queued through GameActionExecutor and use
secretTransferMs; timeout chooses the lowest admissible price. Large ranges use
a native number input with min/max/step rather than enumerating buttons.

| Secret rule | Sequence |
|---|---|
| Normal | Transfer → announce → receiver price if needed → content |
| Public price | Announce → transfer → receiver price if needed → content |
| Historical opener price | Announce → opener price → transfer → content |
| Award | Transfer → reveal/resolve price → score-only award → existing reveal/round completion |

Only announced amount/bounds enter public state. The package's secretRules,
private round-extrema snapshot and unresolved price are omitted. Before an
accepted transfer, award has exactly the same public name, Badge, CTA and
payload shape as an ordinary secret; outcome is absent. After transfer and
resolution, typed `secret-question-awarded` supplies recipient, amount, applied
clamped change and new score. It creates no answer-submitted payload, fake right
answer or answer counters. Current score statistics update through a declared
mutation. Saved award state restores the result on reconnect without applying
it again, and the normal reveal timer completes the round. On timeout with no
eligible recipient, a question shows its personalized content at the resolved or
lowest admissible price. An award with no eligible recipient advances without
scoring, including when it was the last cell.

Nominal `price` remains the board value. Fixed or selected actual amounts use
`realPrice`, only in this live game for dynamic selections. A dynamic secret
cannot enter content/scoring before resolution. Pause/reconnect retain the
current step, actor, timer and already-announced values. Source theme changes
are deliberately ignored; the cell's theme stays unchanged.

## Required frontend behavior

### Question picking transition (React)

A confirmed regular-round pick shows the localized special question-type Badge above
the theme and price; simple questions have no Badge. Over the previous board:
200 ms fade in, 800 ms hold, 250 ms quiet
wait, then a 300 ms fade out when ready (1550 ms for immediately ready clients).
Slow media shows a waiting hint. All roles and editor playtests share the transition;
secret transfers, later bids and final selections do not restart it.

The direct `CHOOSING -> MEDIA_DOWNLOADING` entry has a server opening timer,
parallel to media preparation. Its deadline is `max(pick + 1550 ms, ready + 300 ms)`.
Opening expiry never forces readiness. Text questions use only this timer and
send no media ACK. A readiness status without a question timer keeps preparation
active; release uses the existing media status with the shared question timer,
scheduled 200 ms ahead. A warm first file therefore starts at pick + 1750 ms.

Pause preserves both clocks. ACKs while paused cannot release the question.
Reconnect during preparation restores the remaining opening; snapshots after
release do not replay it. A prepared first frame can mount frozen during fade.
Playback and buzzing wait for the shared start, including under reduced motion.
Separate secret/stake/final entries and legacy active questions keep their
existing paths. See [media synchronization](../../server/docs/media-download-sync.md).

### Question and answer media (React)

Special question-type Badges sit to the right of the price in the same heading row;
simple questions have no Badge. Type explanations appear in a styled native popover
after 300 ms of hovering, or immediately on keyboard focus, rather than a
separate help line. It prefers the space above the Badge with a 6 px gap, falling
back below when needed. Leaving before the delay cancels opening. Escape and
outside clicks dismiss it with a 180 ms fade/scale transition; reduced motion
disables the animation. Descriptions do not repeat the type name. The label has
the default cursor and no click/tap action; it remains keyboard-focusable.
Compact question, answer and audio cards center vertically in
the remaining space under the heading and progress; dense media and long text
use the bounded canvas with scrolling. These rules also apply to final content
and editor previews. Routine audio ready/playing/paused/finished captions are
hidden; keep names, spectrum, loading/errors and sound activation.
Multi-step progress stays in a
separate row directly below the heading. The shared canvas puts text above the
visuals, audio beside or below the visuals, and shared volume and replay controls
last. Text and audio have separate scroll regions. Long text with a long audio
list uses a 60/40 split. One to four images or videos use a grid, with a single
column on phones. Expanding a visual keeps the media element in place.

Authored steps advance on the server phase clock. Within a step with up to four
images or videos, the question's `playMediaSimultaneously` setting controls
whether screen audio and video play together or in order. Missing and null use
the default, true. A step with five or more images or videos always plays its
screen files in order. An audio slot holds the last visible frame or a placeholder.
Explicit background sound follows its own timing across steps.

Only a current authored group with five or more visual files has a thumbnail
strip. Initial playback keeps every thumbnail locked and blurred. Each next
group replaces it, including removing it for text/audio-only groups. Once the
whole timeline and background sounds finish, only that last group remains
(10 thumbnails for 30 groups of 10), available for local file browsing.
A video thumbnail replays only that video from the beginning.
“Replay presentation” restarts the authored steps on a local clock. Both leave the
server deadline and other clients alone. Pausing freezes replay. Answer freeze,
reconnect, a new plan, and a phase change cancel it.

The final keeps the authored answer private during rulings. After the last
ruling, a final answer with files gets a public reveal on the server timer.
Answer media presentations include a five-second browsing window. The final
podium follows that window.
A final answer without files retains the immediate finish.

Audio cards show readiness, buffering, playback, pause, completion or failure.
Their spectrum responds to the audible track. Native playback remains available
when a browser or origin prevents analysis.

### Leaving and home notices (React)

Online leave waits for this user's leave or game deletion; errors or a five-second
timeout allow retry. Offline/disconnected leave completes locally without rejoin.
Leaving the last lobby is voluntary. Before returning home, cancel stale catalogue
reads, remove confirmed deleted/closed games and invalidate all list variants.
Warning notices are dismissible, expire after 30 seconds and remove only `notice`
from the URL with history replacement. Reduced motion removes the closing animation.

### Lobby and question layout

The React dock keeps a stable height through ordinary question phases, pause and
reconnect; bids, secret transfers, final and all-play forms size to their content.
Long names truncate with their full value accessible. Dock explanations and score
lists use disclosure/scrolling as space narrows; enlarged text remains scrollable.

`settings.autoStart` defaults to `true`: a ready command starts play when all
connected players are ready. Manual mode requires the showman's `start`; the
showman can start in either mode without readiness. Leaving the player role
clears readiness. The lobby package overview reads published metadata, which may
differ from the game's snapshot after package edits.

The React field fits between header and dock; overflow scrolls within content
panels. All 15 players and the showman remain accessible in the scrollable score
list with full signed scores up to `SCORE_ABS_LIMIT` (`2_100_000_000`).
Tabs preserve mounted media. Previewing an option image never selects it.
Physical `KeyP` invokes Pass across keyboard
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
non-answerers in no-risk questions. With no connected players, the React showman
preloads and ACKs to open the regular question. Late joiners and spectators do not
block readiness. Timeout forces completion; there is no second data/reveal event.

Content hiding is a product requirement. The
[media coordination reference](../../server/docs/media-download-sync.md) describes
the protocol and verification boundaries.

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
  A valid point target receives the existing `SHOWING_ANSWER` window after the final
  ruling, even without answer files; reconnect during that window restores its image,
  target and source metric before the game finishes. Final points remain manually judged.
  `pointImageOrder` selects the image; absent/null selects the first ordered image.
  Imported `answerPoint.sourceGeometry` uses `hypot(sourceAspect * dx, dy)` with
  minimum deviation .02 (source aspect 1 for old SIQ x,y); its displayed region has
  normalized semiaxes `deviation/sourceAspect` and `deviation`. Measured image aspect
  never changes this metric. Native OQ checking and radius defaults stay unchanged.
  With `answerPoint.imageAspectRatio` and no source metric, distance is `hypot(dx, dy / aspect)`;
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
- **Showman instruction:** `showmanComments` is private before reveal, with legacy
  OQ `questionComment` retained as the showman UI fallback. Neither is sent in
  public question/board projections or public reveal. SIQ `info/comments` uses
  separate `answerExplanation`, shown only after the answer.
- **Authored text and speech:** question/answer text occurrences share their
  phase's file order space and each closes a playback group for its display
  duration. Empty timed screen text clears the screen. Newly imported SIQ speech
  appears as a separate screen text step. Saved private OQ speech keeps the
  previous screen and is delivered only to the showman, including during answer
  reveal and reconnect. Players see a localized showman-reading cue.
  Checking answers and future answer content are separate and remain hidden.
- **Authored answer window:** `answerDurationMs` overrides the pressing window
  after presentation, a designated answerer's window, or the shared all-play/final
  window. Missing/null/0 uses room settings. Buzzing still starts the room's
  `answerSubmitMs` timer. Readiness and presentation consume none of this answer
  window. The direct, all-play and final inputs open only after the timer's start
  lead and the stored presentation plan, even when false starts are disabled.
  Plain legacy captions with no plan add no presentation gate. Pause/reconnect
  retain the authoritative elapsed/remaining timer. Stake/secret media uses the
  existing readiness barrier before direct answering;
  a text-only direct question begins without a media ACK. Final text-only answer
  timelines/explanations enter reveal before game completion.
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
- **Everyone answers** (simple, legacy choice, stake or no-risk with `subType: forEveryone`,
  `gameState.allPlay`): no buzzer. Stake mode starts with hidden stakes from
  every player (`all-play-stake`, 30 s, at most the player's score or the
  price, capped by `maxPrice`; missing stakes become the price). The question
  then preloads and shows; every player types an answer (`all-play-answer`,
  45 s after the content). The showman rules on each answer in REVIEWING
  (`all-play-review`); a missing answer is wrong. Stake: right +stake, wrong
  −stake. Simple/legacy choice: right +actual price, wrong or missing −actual price
  for `wrongAnswerPenalty=subtract`, otherwise 0; there is no bidding phase.
  Actual price and penalty are snapshotted at question start, so later room setting
  changes affect subsequent questions. No-risk: right +actual price × multiplier, wrong ±0. Answers and stakes
  stay hidden from players until the review.
- **Nominal and actual price:** `price` is always the board nominal. Optional
  `realPrice` is the actual base; null/missing falls back to `price`, while zero
  stays zero. Scoring, give-up, timeout, review and preview use the actual base;
  winning/personal stakes take precedence. Secret price choice writes only the
  live question `realPrice`, preserving package/cache/DB and the board. A secret
  actual price is absent from public pre-transfer views and disclosed with the
  question after transfer/price selection; reconnect keeps the resolved amount.
  Legacy fallback with fewer than two players and transfer timeouts resolve
  the lowest offered custom price on a live copy before content/answering.
  Empty or invalid offered lists fail rather than scoring the nominal.
  SIQ secretRules/announcement variants remain separate roadmap work.

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
  The showman must be active, not banned or spectator-restricted. Muting alone
  does not remove permission. The room hears it through the `games` feed (`changed`).

The public events `question-toggle` and `game-join-mode` were renamed to
`question-remove-restore` and `game-join-mode-change`. Their payloads are unchanged.
Update the backend and browser assets together; older browser tabs need a reload.

## Final bid privacy

The first accepted bid is immutable, including after reconnect. Until review starts, players, showmen, and spectators see submission readiness through `submittedBidPlayerIds`; only the owner sees the amount in `bids`. This also applies during media preparation and pauses. At review, `final-submit-end` reveals all bids and settles recorded automatic losses exactly once. A score change before review must not reveal a bid.

Question and script updates send the public projection to room sockets whose
session cannot be verified for that game. A verified showman receives the
answer key for the current question when its phase allows it.

## Common disabled reason categories

Use consistent categories in UI copy and server/client logic:

- `wrong_role` — this role cannot perform the action.
- `wrong_phase` — action is valid in another phase only.
- `not_your_turn` — action belongs to another player/showman.
- `already_done` — user already answered/bid/readied/skipped.
- `not_eligible` — joined late, eliminated, insufficient score, muted/restricted, etc.
- `waiting_for_media` — media readiness has not completed.
- `question_opening` — the local question-pick transition has not finished.
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

### Independent select input

`answerFormat` treats legacy choice as select and otherwise reads answerType.
The input does not change a question's mechanics, auction, transfer or scoring.
Select uses the same option controls for sequential, all-play and final answers;
all-play/final commands carry optional choiceOrder alongside the display answer.
The server validates integer membership, unique orders and canonical display
payload before storing a selection. New select requires explicit identity.
For an explicit select, automatic judging uses only the correct option order;
legacy choice retains its text aliases and manual handling of ambiguous answers.
The first accepted all-play/final submission remains immutable. Wrong sequential
choices stay blocked for that question; all-play players may choose the same
wrong option independently. All-play auto-check uses stored option identity;
final review remains manual. Before review, role-filtered snapshots hide other
answers and choiceOrder as well as bids. Correct keys stay private until reveal.
After the last final ruling a keyed select option gets a timed public reveal even
when the question has no authored answerFiles. correctChoice carries its text,
source label and media on the reveal event/snapshot only.

Options wait for their content/showDelay and readiness. Option audio/video has
local playback controls; playing/previewing media never submits the choice.
Pause/offline/pending/accepted guards keep controls mounted, and a rejected send
remains manually retryable. Direct special questions preload option resources
locally before enabling their input; standard/final preparation includes option
media in the existing readiness flow. This does not add option media to the
authored timeline or change its 10/30 limits.

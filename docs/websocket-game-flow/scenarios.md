# Edge case scenarios (quick lookup)

These are the most common “what happens if …” cases. Each describes the **server-side behavior** and the **events the frontend should expect**.

Note: broadcasts can be emitted very close together; clients should not assume strict ordering across different sockets.

---

## Quick lookup (jump table)

| Area                 | Scenario                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Lobby / start        | [Join rejected (restrictions / game full / showman slot / final round)](#join-rejected)         |
| Lobby / start        | [Leave when not in a game](#leave-not-in-game)                                                  |
| Lobby / start        | [Last active player leaves (game cleanup)](#last-player-leaves)                                 |
| Lobby / start        | [Start rejected (not showman / already started)](#start-rejected)                               |
| Readiness            | [Everyone ready before start (auto-start)](#auto-start)                                         |
| Leaves / disconnects | [Player leaves while they are the current `answeringPlayer`](#leave-answering-player)           |
| Leaves / disconnects | [Player leaves while question is in `MEDIA_DOWNLOADING`](#leave-media-downloading)              |
| Leaves / disconnects | [Player disconnects (no explicit leave)](#disconnect)                                           |
| Media download       | [All players downloaded media (transition to showing)](#media-all-downloaded)                   |
| Media download       | [Media download timeout expires](#media-download-timeout)                                       |
| Timers               | [Showing timer expires (question was not answered)](#showing-timeout)                           |
| Timers               | [Answering timer expires (normal rounds)](#answering-timeout)                                   |
| Final round          | [Final round answering timer expires](#final-answering-timeout)                                 |
| Question pick        | [Question already played (rejected)](#question-already-played)                                  |
| Question pick        | [Secret/stake question with no eligible players (fallback)](#no-eligible-secret-stake-fallback) |
| Answer result        | [Wrong answer but others can still answer](#wrong-answer-others-can-answer)                     |
| Answer result        | [Wrong answer and everyone is exhausted](#wrong-answer-exhausted)                               |
| Answer result        | [Correct answer (turn advances, question cleared)](#correct-answer)                             |
| Skips                | [“Give up” skip is treated as wrong answer](#give-up-skip)                                      |
| Skips                | [All players skipped (question auto-finishes)](#all-skipped)                                    |
| Skips                | [Showman forces skip (skip-question-force)](#force-skip)                                        |
| Stake bidding        | [Bidder leaves during stake bidding](#stake-bidder-leaves)                                      |
| Final round          | [Player tries to join as `player` during final round](#final-join-player-rejected)              |
| Final round          | [Player leaves during final bidding without bidding](#final-bidder-leaves)                      |
| Final round          | [Player submits empty final answer](#final-empty-answer)                                        |
| Final round          | [Player leaves during final answering](#final-leave-answering)                                  |
| Final round          | [Theme elimination completes (auto bids / proceed)](#final-elimination-complete)                |
| Final round          | [Turn player leaves during theme elimination](#final-turn-leaves-elimination)                   |
| Moderation           | [Player is kicked](#player-kicked)                                                              |
| Moderation           | [Player is restricted / banned](#player-restricted-banned)                                      |

---

## Join / leave / start

### <a id="join-rejected"></a> Join rejected (restrictions / game full / showman slot / final round)

Server behavior:

- Rejects join with `error` when the user is not allowed to enter with the requested role (banned, restricted trying to join as non-spectator, player slot full, showman slot already taken, or final-round integrity rules).

Events:

- `error`

### <a id="leave-not-in-game"></a> Leave when not in a game

Server behavior:

- No-op (no room broadcast).

Events:

- none

### <a id="last-player-leaves"></a> Last active player leaves (game cleanup)

Server behavior:

- If the last active player leaves before game start (or after finish), server deletes the game state.

Events:

- `user-leave` (for the leaving user)

### <a id="start-rejected"></a> Start rejected (not showman / already started)

Server behavior:

- Rejects `start` if the requester is not the showman, or the game is already started.

Events:

- `error`

### <a id="auto-start"></a> Everyone ready before start (auto-start)

Server behavior:

- When all required participants become ready and the game hasn’t started, server triggers auto-start.

Events:

- `player-ready`
- `start`

## Player leaves / disconnects during normal question

### <a id="leave-answering-player"></a> Player leaves while they are the current `answeringPlayer`

Server behavior:

- Score impact: **0** (`AnswerResultType.SKIP`)
- State transition:
  - Normal question: goes to `SHOWING` (answer reveal) and starts/continues a showing timer
  - Secret/stake question: question is treated as finished and the game returns to `CHOOSING`

Events you may see:

- `user-leave` (always)
- `answer-result` (only if leaving player was `answeringPlayer`)
  - Normal question includes `timer`
  - Special question includes `timer: null`

### <a id="leave-media-downloading"></a> Player leaves while question is in `MEDIA_DOWNLOADING`

Server behavior:

- If all remaining active players are already ready, server clears the download timer and starts the real `SHOWING` timer.

Events you may see:

- `user-leave`
- `media-download-status` (only if this leave made the remaining set “all ready”)

### <a id="disconnect"></a> Player disconnects (no explicit leave)

Server behavior:

- The server runs the same cleanup pipeline as `user-leave`, then clears socket auth.

Events you may see:

- Same as `user-leave` scenario(s)

---

## Timer expirations

### <a id="media-download-timeout"></a> Media download timeout expires

### <a id="media-all-downloaded"></a> All players downloaded media (transition to showing)

Server behavior:

- When all active players report media downloaded, server transitions from `MEDIA_DOWNLOADING → SHOWING` and starts a showing timer.

Events:

- `media-download-status` with a non-null `timer`

Server behavior:

- Forces all active players to `mediaDownloaded = true`
- Transitions to `SHOWING` and starts a showing timer

Events:

- `media-download-status` with `playerId = SYSTEM_PLAYER_ID` and a `timer`

### <a id="showing-timeout"></a> Showing timer expires (question was not answered)

Server behavior:

- Resets to `CHOOSING`
- If this was the last question, progresses the round or ends the game

Events:

- `question-finish`
- Possibly `next-round` or `game-finished`

### <a id="answering-timeout"></a> Answering timer expires (normal rounds)

Server behavior:

- Treats it as `WRONG` with negative score for priced questions
- Transitions to `SHOWING` and starts a showing timer

Events:

- `answer-result` with `AnswerResultType.WRONG` and a `timer`

### <a id="final-answering-timeout"></a> Final round answering timer expires

Server behavior:

- Any player without a submitted answer gets auto-loss (timeout)
- When all are resolved, transitions to reviewing

Events:

- `final-answer-submit` (for each auto-resolved player)
- `final-auto-loss` with reason `timeout`
- `final-submit-end` when ready for reviewing

---

## Stake question bidding

### <a id="stake-bidder-leaves"></a> Bidder leaves during stake bidding

Server behavior:

- Auto-pass that bidder (`bidAmount: null`, `bidType: PASS`)
- If bidding is forced to complete, server determines winner or skips the question

Events:

- `stake-bid-submit` for the leaving bidder
- Possibly `stake-question-winner`
- If a winner exists: `question-data` starts the question

---

## Final round

### <a id="final-join-player-rejected"></a> Player tries to join as `player` during final round

Server behavior:

- Rejected unless the user was already a `player` in that game.

Events:

- `error`

### <a id="final-bidder-leaves"></a> Player leaves during final bidding without bidding

Server behavior:

- Auto-bids minimum and marks it automatic
- If that completed bidding, server immediately proceeds to answering

Events:

- `user-leave`
- `final-bid-submit` with `isAutomatic: true`
- Possibly `final-question-data` + `final-phase-complete` (bidding → answering)

### <a id="final-empty-answer"></a> Player submits empty final answer

Server behavior:

- Treats empty answer as auto-loss.

Events:

- `final-answer-submit`
- `final-auto-loss` with reason `empty_answer`

### <a id="final-leave-answering"></a> Player leaves during final answering

Server behavior:

- Submits empty answer for them and marks auto-loss
- If that completes the phase, transitions to reviewing

Events:

- `user-leave`
- `final-answer-submit`
- `final-auto-loss` with reason `empty_answer`
- Possibly `final-submit-end`

### <a id="final-turn-leaves-elimination"></a> Turn player leaves during theme elimination

Server behavior:

- Server performs an automatic elimination (same as timeout path)

Events:

- `user-leave`
- `theme-eliminate` with `eliminatedBy = SYSTEM_PLAYER_ID`
- Possibly `final-phase-complete` (theme_elimination → bidding)

### <a id="final-elimination-complete"></a> Theme elimination completes (auto bids / proceed)

Server behavior:

- When elimination ends, server transitions to bidding and may emit automatic bids (e.g., for forced/absent players).
- If all bids are automatic, server may immediately reveal the final question and transition to answering.

Events:

- `final-phase-complete` (theme_elimination → bidding)
- One or more `final-bid-submit` with `isAutomatic: true`
- Possibly `final-question-data` + `final-phase-complete` (bidding → answering)

---

## Question pick / validation

### <a id="question-already-played"></a> Question already played (rejected)

Server behavior:

- Rejects picking a question that is already marked as played.

Events:

- `error`

### <a id="no-eligible-secret-stake-fallback"></a> Secret/stake question with no eligible players (fallback)

Server behavior:

- If there are no eligible active players for a secret/stake mechanic, server falls back to normal question flow.

Events:

- `question-data` (normal question)

---

## Answer results / skipping

### <a id="wrong-answer-others-can-answer"></a> Wrong answer but others can still answer

Server behavior:

- Keeps the question in progress and continues `SHOWING` with a timer so the next eligible player can buzz.

Events:

- `answer-result` with a non-null `timer`

### <a id="wrong-answer-exhausted"></a> Wrong answer and everyone is exhausted

Server behavior:

- Ends the question early and returns to choosing.

Events:

- `answer-result`
- `question-finish`

### <a id="correct-answer"></a> Correct answer (turn advances, question cleared)

Server behavior:

- Marks the question as played and clears `currentQuestion`.
- In simple rounds, the answering player becomes the next `currentTurnPlayerId`.

Events:

- `answer-result`
- `question-finish`

### <a id="give-up-skip"></a> “Give up” skip is treated as wrong answer

Server behavior:

- Treats the skip as a wrong answer with penalty (instead of a `question-skip` broadcast).

Events:

- `answer-result`

### <a id="all-skipped"></a> All players skipped (question auto-finishes)

Server behavior:

- Auto-finishes the question and progresses as needed.

Events:

- `question-finish`
- Possibly `next-round` or `game-finished`

### <a id="force-skip"></a> Showman forces skip (skip-question-force)

Server behavior:

- Skips the currently active question (normal/secret/stake) and progresses.

Events:

- `question-finish`
- Possibly `next-round` or `game-finished`

---

## Moderation

### <a id="player-kicked"></a> Player is kicked

Server behavior:

- Uses the same cleanup pipeline as `user-leave`, so additional phase-dependent cleanup broadcasts may appear.

Events:

- `player-kicked`
- `user-leave`
- Possibly other cleanup events (depends on current phase)

### <a id="player-restricted-banned"></a> Player is restricted / banned

Server behavior:

- Restriction is broadcast to the room.
- If `banned: true`, server also removes the player from the game (leave flow).
- If restriction forces a role change, server broadcasts `player-role-change`.

Events:

- `player-restricted`
- Possibly `player-role-change`
- If banned: `user-leave`

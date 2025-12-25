# Game Socket.IO events reference

Legend:

- **C→S**: client emits to server (request)
- **S→C**: server emits to client(s) (broadcast)
- Some events reuse the same name for request + broadcast; others are only one direction.

Common payload shapes (backend types):

- `timer`: `GameStateTimerDTO` = `{ startedAt: Date, durationMs: number, elapsedMs: number }`
- `error`: `{ message: string }` (sent to the origin socket)

---

## Quick lookup (jump table)

Click an event name to jump to its section.

| Area        | Event                                                   | Direction |
| ----------- | ------------------------------------------------------- | --------- |
| Lobby       | [`join`](#join)                                         | C→S + S→C |
| Lobby       | [`game-data`](#game-data)                               | S→C       |
| Lobby       | [`user-leave`](#user-leave)                             | C→S + S→C |
| Lobby       | [`disconnect`](#disconnect)                             | internal  |
| Game        | [`start`](#start)                                       | C→S + S→C |
| Game        | [`game-pause`](#game-pause)                             | C→S + S→C |
| Game        | [`game-unpause`](#game-unpause)                         | C→S + S→C |
| Readiness   | [`player-ready`](#player-ready)                         | C→S + S→C |
| Readiness   | [`player-unready`](#player-unready)                     | C→S + S→C |
| Readiness   | [`media-downloaded`](#media-downloaded)                 | C→S       |
| Readiness   | [`media-download-status`](#media-download-status)       | S→C       |
| Question    | [`question-pick`](#question-pick)                       | C→S       |
| Question    | [`question-data`](#question-data)                       | S→C       |
| Question    | [`question-answer`](#question-answer)                   | C→S + S→C |
| Question    | [`answer-submitted`](#answer-submitted)                 | C→S + S→C |
| Question    | [`answer-result`](#answer-result)                       | C→S + S→C |
| Question    | [`question-finish`](#question-finish)                   | S→C       |
| Question    | [`question-skip`](#question-skip)                       | C→S + S→C |
| Question    | [`question-unskip`](#question-unskip)                   | C→S + S→C |
| Question    | [`skip-question-force`](#skip-question-force)           | C→S + S→C |
| Secret      | [`secret-question-picked`](#secret-question-picked)     | S→C       |
| Secret      | [`secret-question-transfer`](#secret-question-transfer) | C→S + S→C |
| Stake       | [`stake-question-picked`](#stake-question-picked)       | S→C       |
| Stake       | [`stake-bid-submit`](#stake-bid-submit)                 | C→S + S→C |
| Stake       | [`stake-question-winner`](#stake-question-winner)       | S→C       |
| Final       | [`theme-eliminate`](#theme-eliminate)                   | C→S + S→C |
| Final       | [`final-bid-submit`](#final-bid-submit)                 | C→S + S→C |
| Final       | [`final-phase-complete`](#final-phase-complete)         | S→C       |
| Final       | [`final-question-data`](#final-question-data)           | S→C       |
| Final       | [`final-answer-submit`](#final-answer-submit)           | C→S + S→C |
| Final       | [`final-auto-loss`](#final-auto-loss)                   | S→C       |
| Final       | [`final-submit-end`](#final-submit-end)                 | S→C       |
| Final       | [`final-answer-review`](#final-answer-review)           | C→S + S→C |
| Progression | [`next-round`](#next-round)                             | C→S + S→C |
| Progression | [`game-finished`](#game-finished)                       | S→C       |
| Players     | [`player-role-change`](#player-role-change)             | C→S + S→C |
| Players     | [`player-slot-change`](#player-slot-change)             | C→S + S→C |
| Players     | [`score-changed`](#score-changed)                       | C→S + S→C |
| Players     | [`turn-player-changed`](#turn-player-changed)           | C→S + S→C |
| Players     | [`player-kicked`](#player-kicked)                       | C→S + S→C |
| Players     | [`player-restricted`](#player-restricted)               | C→S + S→C |
| Players     | [`player-banned`](#player-banned)                       | reserved  |
| System      | [`error`](#error)                                       | S→C       |
| System      | [`chat-message`](#chat-message)                         | C→S + S→C |

---

## Lobby / joining / leaving

### `join`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `GameJoinInputData` = `{ gameId: string, role: PlayerRole }`
- S→C broadcasts:
  - To the whole game room: `join` with `PlayerDTO`
  - To the joining socket only: `game-data` with `GameJoinOutputData` (full lobby + state snapshot)

Edge cases (server-handled):

- See scenarios: [Join rejected (restrictions / game full / showman slot / final round)](scenarios.md#join-rejected)

### `game-data`

- Direction: **S→C** (to the joining socket)
- Payload: `GameJoinOutputData` = `{ meta, players, gameState, chatMessages }`

Notes:

- Treat this as the authoritative initial snapshot for UI.

### `user-leave`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `EmptyInputData` (`{}`)
- S→C payload: `GameLeaveEventPayload` = `{ user: number }`

Edge cases (server-handled):

- See scenarios:
  - [Leave when not in a game](scenarios.md#leave-not-in-game)
  - [Last active player leaves (game cleanup)](scenarios.md#last-player-leaves)
  - [Player leaves while they are the current `answeringPlayer`](scenarios.md#leave-answering-player)
  - [Player leaves while question is in `MEDIA_DOWNLOADING`](scenarios.md#leave-media-downloading)
  - [Bidder leaves during stake bidding](scenarios.md#stake-bidder-leaves)
  - [Player leaves during final bidding without bidding](scenarios.md#final-bidder-leaves)
  - [Player leaves during final answering](scenarios.md#final-leave-answering)

### `disconnect`

- Direction: Socket.IO internal
- Server behavior:
  - Attempts `user-leave` flow first (same cleanup broadcasts as above)
  - Always clears auth/session for that socket

See scenarios: [Player disconnects (no explicit leave)](scenarios.md#disconnect)

---

## Game start / pause

### `start`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `EmptyInputData` (`{}`)
- S→C payload: `GameStartEventPayload` = `{ currentRound: GameStateRoundDTO }`

Edge cases (server-handled):

- See scenarios: [Start rejected (not showman / already started)](scenarios.md#start-rejected)

### `game-pause`

- Direction: **C→S** request, **S→C** broadcast
- Payload: `GamePauseBroadcastData` = `{ timer: GameStateTimerDTO | null }`

### `game-unpause`

- Direction: **C→S** request, **S→C** broadcast
- Payload: `GameUnpauseBroadcastData` = `{ timer: GameStateTimerDTO | null }`

---

## Player readiness / media download

### `player-ready`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `EmptyInputData` (`{}`)
- S→C payload: `PlayerReadinessBroadcastData` = `{ playerId, isReady, readyPlayers, autoStartTriggered? }`

Edge cases (server-handled):

- See scenarios: [Everyone ready before start (auto-start)](scenarios.md#auto-start)

### `player-unready`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `EmptyInputData` (`{}`)
- S→C payload: `PlayerReadinessBroadcastData` = `{ playerId, isReady, readyPlayers, autoStartTriggered? }`

### `media-downloaded`

- Direction: **C→S** request
- Payload: `EmptyInputData` (`{}`)

### `media-download-status`

- Direction: **S→C** broadcast
- Payload: `MediaDownloadStatusBroadcastData` = `{ playerId, mediaDownloaded, allPlayersReady, timer: GameStateTimerDTO | null }`

Edge cases (server-handled):

- See scenarios:
  - [All players downloaded media (transition to showing)](scenarios.md#media-all-downloaded)
  - [Media download timeout expires](scenarios.md#media-download-timeout)
  - [Player leaves while question is in `MEDIA_DOWNLOADING`](scenarios.md#leave-media-downloading)

---

## Normal question flow

### `question-pick`

- Direction: **C→S** request
- Payload: `{ questionId: number }`

Server broadcasts (depends on question type):

- Normal question:
  - emits `question-data` to each socket (role-based question payload)
  - starts `MEDIA_DOWNLOADING` timer (clients must send `media-downloaded`)
- Secret question:
  - emits `secret-question-picked`
  - later, after `secret-question-transfer`, emits `question-data` to each socket
- Stake question:
  - emits `stake-question-picked`
  - may emit an automatic `stake-bid-submit`
  - if bidding completes automatically, emits `stake-question-winner` and `question-data`

Edge cases (server-handled):

- See scenarios:
  - [Question already played (rejected)](scenarios.md#question-already-played)
  - [Secret/stake question with no eligible players (fallback)](scenarios.md#no-eligible-secret-stake-fallback)

### `question-data`

- Direction: **S→C** broadcast (often per-socket)
- Payload: `GameQuestionDataEventPayload` = `{ data: PackageQuestionDTO | SimplePackageQuestionDTO, timer: GameStateTimerDTO }`

Notes:

- Showman receives full question; others receive a simplified question.

### `question-answer`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `EmptyInputData` (`{}`)
- S→C payload: `QuestionAnswerEventPayload` = `{ userId: number, timer: GameStateTimerDTO }`

Notes:

- This transitions into `ANSWERING` and sets `answeringPlayer` server-side.

Edge cases (server-handled):

- Server saves the prior `SHOWING` timer as a restore point.

### `answer-submitted`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `AnswerSubmittedInputData` = `{ answerText: string | null }`
- S→C payload: `AnswerSubmittedBroadcastData` = `{ answerText: string | null }`

Important:

- Backend currently validates “is answering player” but **does not persist** the submitted text (marked `TODO` server-side). Treat as UI-only / showman-assist.

### `answer-result`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `AnswerResultData` = `{ answerType: "correct" | "wrong" | "skip", scoreResult: number }`
- S→C payload: `QuestionAnswerResultEventPayload` = `{ answerResult: GameStateAnsweredPlayerData, timer: GameStateTimerDTO | null }`

Edge cases (server-handled):

- See scenarios:
  - [Wrong answer but others can still answer](scenarios.md#wrong-answer-others-can-answer)
  - [Wrong answer and everyone is exhausted](scenarios.md#wrong-answer-exhausted)
  - [Correct answer (turn advances, question cleared)](scenarios.md#correct-answer)

### `question-finish`

- Direction: **S→C** broadcast
- Payload:
  - `QuestionFinishEventPayload` = `{ answerFiles, answerText, nextTurnPlayerId }`
  - When finishing due to a decisive answer, server may use `QuestionFinishWithAnswerEventPayload` (same fields + `answerResult`).

Edge cases (server-handled):

- See scenarios:
  - [Showing timer expires (question was not answered)](scenarios.md#showing-timeout)
  - [All players skipped (question auto-finishes)](scenarios.md#all-skipped)

### `question-skip`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `EmptyInputData` (`{}`)
- S→C payload: `QuestionSkipBroadcastData` = `{ playerId: number }`

Edge cases (server-handled):

- See scenarios:
  - [“Give up” skip is treated as wrong answer](scenarios.md#give-up-skip)
  - [All players skipped (question auto-finishes)](scenarios.md#all-skipped)

### `question-unskip`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `EmptyInputData` (`{}`)
- S→C payload: `QuestionUnskipBroadcastData` = `{ playerId: number }`

### `skip-question-force`

- Direction: **C→S** request (showman), **S→C** broadcasts
- Payload: `EmptyInputData` (`{}`)

Notes:

- Works for normal, stake, and secret questions by finding the active question from the correct state field.
- Marks the question as played and resets to choosing, then emits progression (`question-finish`, `next-round`, `game-finished`) as needed.

---

## Secret question

### `secret-question-picked`

- Direction: **S→C** broadcast
- Payload: `SecretQuestionPickedBroadcastData` = `{ pickerPlayerId, transferType, questionId }`

### `secret-question-transfer`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `SecretQuestionTransferInputData` = `{ targetPlayerId: number }`
- S→C payload: `SecretQuestionTransferBroadcastData` = `{ fromPlayerId, toPlayerId, questionId }`

Server behavior:

- After broadcasting transfer, server emits `question-data` to each socket (role-based question payload) with the timer.

---

## Stake question

### `stake-question-picked`

- Direction: **S→C** broadcast
- Payload: `StakeQuestionPickedBroadcastData` = `{ pickerPlayerId, questionId, maxPrice, biddingOrder, timer }`

### `stake-bid-submit`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `StakeBidSubmitInputData` = `{ bidType, bidAmount }`
- S→C payload: `StakeBidSubmitOutputData` = `{ playerId, bidAmount, bidType, isPhaseComplete?, nextBidderId?, timer? }`

Edge cases (server-handled):

- See scenarios: [Bidder leaves during stake bidding](scenarios.md#stake-bidder-leaves)

### `stake-question-winner`

- Direction: **S→C** broadcast
- Payload: `StakeQuestionWinnerEventData` = `{ winnerPlayerId, finalBid }`

When emitted:

- Immediately after bidding completes.
- If bidding completes, server also emits `question-data` with the question and timer.

---

## Final round

### `theme-eliminate`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `ThemeEliminateInputData` = `{ themeId: number }`
- S→C payload: `ThemeEliminateOutputData` = `{ themeId, eliminatedBy, nextPlayerId }`

Edge cases (server-handled):

- See scenarios:
  - [Turn player leaves during theme elimination](scenarios.md#final-turn-leaves-elimination)
  - [Theme elimination completes (auto bids / proceed)](scenarios.md#final-elimination-complete)

### `final-bid-submit`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `FinalBidSubmitInputData` = `{ bid: number }`
- S→C payload: `FinalBidSubmitOutputData` = `{ playerId, bidAmount, isAutomatic? }`

Edge cases (server-handled):

- See scenarios: [Player leaves during final bidding without bidding](scenarios.md#final-bidder-leaves)

### `final-phase-complete`

- Direction: **S→C** broadcast
- Payload: `FinalPhaseCompleteEventData` = `{ phase: FinalRoundPhase, nextPhase?: FinalRoundPhase, timer?: GameStateTimerDTO }`

### `final-question-data`

- Direction: **S→C** broadcast
- Payload: `FinalQuestionEventData` = `{ questionData }`

### `final-answer-submit`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `FinalAnswerSubmitInputData` = `{ answerText: string }`
- S→C payload: `FinalAnswerSubmitOutputData` = `{ playerId: number }`

Edge cases (server-handled):

- See scenarios: [Player submits empty final answer](scenarios.md#final-empty-answer)

### `final-auto-loss`

- Direction: **S→C** broadcast
- Payload: `FinalAutoLossEventData` = `{ playerId: number, reason: "empty_answer" | "timeout" }`

See scenarios:

- [Player submits empty final answer](scenarios.md#final-empty-answer)
- [Final round answering timer expires](scenarios.md#final-answering-timeout)
- [Player leaves during final answering](scenarios.md#final-leave-answering)

### `final-submit-end`

- Direction: **S→C** broadcast
- Payload: `FinalSubmitEndEventData` = `{ phase: FinalRoundPhase, nextPhase?: FinalRoundPhase, allReviews?: AnswerReviewData[] }`

Emitted when:

- All players have submitted or have been auto-lost.

### `final-answer-review`

- Direction: **C→S** request (showman), **S→C** broadcast
- C→S payload: `FinalAnswerReviewInputData` = `{ answerId: string, isCorrect: boolean }`
- S→C payload: `FinalAnswerReviewOutputData` = `{ answerId, playerId, isCorrect, scoreChange }`

When all reviews are done and the game ends:

- server emits `question-finish` (final answer text) and then `game-finished`.

---

## Round / game progression

### `next-round`

- Direction: **C→S** request (showman), **S→C** broadcast
- Payload: `GameNextRoundEventPayload` = `{ gameState: GameStateDTO }`

Notes:

- In final round, this is role-filtered: showman sees full themes/questions; others see themes with empty question arrays.

### `game-finished`

- Direction: **S→C** broadcast
- Payload: `true`

---

## Player management

### `player-role-change`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `PlayerRoleChangeInputData` = `{ playerId: number | null, newRole: PlayerRole }`
- S→C payload: `PlayerRoleChangeBroadcastData` = `{ playerId, newRole, players }`

### `player-slot-change`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `PlayerSlotChangeInputData` = `{ targetSlot: number, playerId?: number }`
- S→C payload: `PlayerSlotChangeBroadcastData` = `{ playerId, newSlot, players }`

### `score-changed`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `PlayerScoreChangeInputData` = `{ playerId: number, newScore: number }`
- S→C payload: `PlayerScoreChangeBroadcastData` = `{ playerId, newScore }`

### `turn-player-changed`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `TurnPlayerChangeInputData` = `{ newTurnPlayerId: number | null }`
- S→C payload: `TurnPlayerChangeBroadcastData` = `{ newTurnPlayerId: number | null }`

### `player-kicked`

- Direction: **C→S** request, **S→C** broadcast
- Payload: `{ playerId: number }`

Notes:

- See scenarios: [Player is kicked](scenarios.md#player-kicked)

### `player-restricted`

- Direction: **C→S** request, **S→C** broadcast
- C→S payload: `PlayerRestrictionInputData` = `{ playerId, muted, restricted, banned }`
- S→C payload: `PlayerRestrictionBroadcastData` = `{ playerId, muted, restricted, banned }`

Edge cases (server-handled):

- See scenarios: [Player is restricted / banned](scenarios.md#player-restricted-banned)

### `player-banned`

- Direction: **(reserved)**

Notes:

- This event exists in `SocketIOGameEvents`, but it is not emitted by the current backend flow.
- Bans are communicated via `player-restricted` (`banned: true`) + `user-leave`.

---

## System

### `error`

- Direction: **S→C** (to the origin socket)
- Payload: `{ message: string }`

### `chat-message`

- Direction: **C→S**, **S→C**
- Payload: `{ uuid, timestamp, user, message }`

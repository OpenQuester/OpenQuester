# Media download coordination

This is the implementation reference for the normal-question path in a regular
round. Secret, stake, and final questions have separate transitions; do not
apply this handshake to them without inspecting their handlers.

The server coordinates **reported readiness**, not file transfers. Receiving
`QUESTION_DATA`, entering `MEDIA_DOWNLOADING`, downloading bytes, and revealing
content are separate events. Backend coordination alone does not guarantee
that a browser waits for downloads or hides question content.

## Current Socket.IO contract

Namespace: `/games`. Wire names are lowercase kebab-case; the uppercase names
below refer to backend enum members. Public metadata and payload schemas live
in [OpenAPI](../../openapi/schema.json).

| Step | Direction / event | State and payload |
| --- | --- | --- |
| Pick | Client → server `QUESTION_PICK` | Input `{ questionId }`; existing role/phase validation applies. |
| Deliver data | Server → game clients `QUESTION_DATA` | Role-filtered question data, including file links, and the media timer. Persisted phase is `MEDIA_DOWNLOADING`; readiness flags are reset. Showman-only answers are not sent to players/spectators. |
| Partial readiness | Client → server `MEDIA_DOWNLOADED`, then server → game `MEDIA_DOWNLOAD_STATUS` | No application payload is required for the command. Status includes `playerId`, `mediaDownloaded: true`, `allPlayersReady: false`, `timer: null`. The existing media timer remains active. |
| Last required readiness | Same command/status pair | The last eligible, connected player's ACK completes readiness, enters `SHOWING`, and supplies the question timer and `contentPlan` in the status. |
| Timeout | Server → game `MEDIA_DOWNLOAD_STATUS` | Forces eligible, connected players ready, enters `SHOWING`, and starts the question timer. Status uses `playerId: -1` (`SYSTEM_PLAYER_ID`) and `allPlayersReady: true`; it does not prove successful downloads. |

The barrier waits for connected `PlayerRole.PLAYER` participants captured at
the question pick, including no-risk viewers who cannot answer. This roster is
persisted separately from answer eligibility. Late joiners and promoted
spectators do not join it; an eligible reconnecting player preloads again.
Legacy games without the stored roster retain the active-player fallback until
the next pick. Showman/spectator ACKs do not block readiness. The departure flow
updates the connected set and broadcasts completion when nobody remains to wait for.

Regular questions without files still enter the same backend handshake.
Clients immediately ACK when `questionFiles ?? []` is empty; the backend does
not auto-skip the phase merely because there are no files.

There is **no inbound preload `QUESTION_PICK`**, and completing readiness does
**not** produce a second `QUESTION_DATA`. Initial data delivery provides links
and content; it is not a server instruction to reveal/play it immediately.

Here ACK means the application command `MEDIA_DOWNLOADED`, not a Socket.IO
callback acknowledgement or proof that an action reached the Redis queue.

## Phase guards, duplicate ACKs, and timers

- After authentication/player validation, an ACK outside `MEDIA_DOWNLOADING`
  is a successful no-op: no readiness change, save/timer mutation, or status
  broadcast. This includes late ACKs during `SHOWING`.
- A player outside the captured roster cannot change readiness or report durations.
- Repeated ACKs while still in the media phase can produce repeated status
  broadcasts. Do not document them as universally deduplicated. ACKs queued
  after completion are covered by the phase guard.
- Selection starts `MEDIA_DOWNLOAD_TIMEOUT` (30 s, long enough for a slow
  phone to load a picture; the web client hides this countdown and shows
  "x of y players ready" instead); partial status `timer: null`
  means no replacement timer, not that the running media timer was removed.
- Readiness completion or timeout starts `GAME_QUESTION_ANSWER_TIME`.
- An ACK has no question identifier. The phase guard is not a general guarantee
  against a delayed client callback landing in a later question's media phase.

## Client obligations

Prepare the current question's media and send readiness after preparation, or
immediately for a question without files. Gate visible content and playback
on readiness completion. The server timeout can advance play even if a
participant could not prepare the media.

The browser implementation is described in `web/AGENTS.md`. Verify byte
completion, image decoding, reveal and playback separately in the browser,
including delayed preparation, question replacement and reconnect.

## Backend implementation and verification

Backend source paths (repository-relative):

- `server/src/application/usecases/question/QuestionPickUseCase.ts`
- `server/src/application/services/socket/SocketActionHooks.ts`
- `server/src/application/usecases/game/MediaDownloadedUseCase.ts`
- `server/src/domain/logic/question/MediaDownloadLogic.ts`
- `server/src/domain/state-machine/handlers/regular-round/ChoosingToMediaDownloadingHandler.ts`
- `server/src/domain/state-machine/handlers/regular-round/MediaDownloadingToShowingHandler.ts`
- `server/src/application/services/timer/TimerExpirationService.ts`
- `server/src/domain/types/socket/events/game/MediaDownloadStatusEventPayload.ts`

Follow the [E2E README](../tests/e2e/README.md) for test writing and commands.
Transport cases use real sockets/Redis/PostgreSQL, supply file metadata, and
simulate client ACKs. They assert the media phase and active timer **before any
ACK**, partial readiness, completion/timeout, and exact relevant event counts.
A correct `QUESTION_DATA` with an already-`SHOWING` state must fail.

Controlled helper self-tests prove assertions reject injected defects; they
are not evidence of backend health. Backend transport tests prove coordination,
while download, reveal, and playback need browser evidence. Keep those evidence
boundaries explicit in bug reports and release claims.

## Content timeline (question sequencing)

The `media-downloaded` ACK may carry `{ mediaDurations: [{ md5, durationMs }] }`:
real audio/video lengths read while preloading. The server keeps the longest
report per file of the current question (`gameState.mediaDurations`, capped at
`CONTENT_ITEM_MAX_TIME`) and ignores unknown md5s.

On entering `SHOWING`, `QuestionContentPlanLogic` builds `questionContentPlan`
(SIGame parity): items play in order (file `order`, plus the question text when
`textOrder` is set), grouped into one step until an item that waits for its
finish. A step lasts as long as its longest item; non-waiting background audio
does not stretch it. Item time is `displayTime`, else the reported length
(audio/video), else a default. The buzzer opens at `buzzerOpensAtMs` (see
`docs/specs/buzzer-state-machine.md`), sent next to every `contentPlan`. The
question timer is `max(totalMs, buzzerOpensAtMs)` plus
`GAME_QUESTION_ANSWER_TIME`, and clients read the timeline position from
that timer's elapsed time, so pauses, buzzes (the saved SHOWING timer) and
reconnects stay in step. The plan travels with the completion status
(`contentPlan`), `question-data` for direct-answer paths, and the game state.
Answer files get the same treatment as `answerContentPlan` in the reveal
payload, timed with the show-answer defaults.

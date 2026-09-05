# Media download coordination

This is the implementation reference for the normal-question path in a regular
round. Secret, stake, and final questions have separate transitions; do not
apply this handshake to them without inspecting their handlers.

The server coordinates **reported readiness**, not file transfers. Receiving
`QUESTION_DATA`, entering `MEDIA_DOWNLOADING`, downloading bytes, and revealing
content are separate events. Backend coordination alone does not guarantee
that Flutter waits for downloads or hides question content.

## Current Socket.IO contract

Namespace: `/games`. Wire names are lowercase kebab-case; the uppercase names
below refer to backend enum members. Public metadata and payload schemas live
in [OpenAPI](../../openapi/schema.json).

| Step | Direction / event | State and payload |
| --- | --- | --- |
| Pick | Client → server `QUESTION_PICK` | Input `{ questionId }`; existing role/phase validation applies. |
| Deliver data | Server → game clients `QUESTION_DATA` | Role-filtered question data, including file links, and the media timer. Persisted phase is `MEDIA_DOWNLOADING`; readiness flags are reset. Showman-only answers are not sent to players/spectators. |
| Partial readiness | Client → server `MEDIA_DOWNLOADED`, then server → game `MEDIA_DOWNLOAD_STATUS` | No application payload is required for the command. Status includes `playerId`, `mediaDownloaded: true`, `allPlayersReady: false`, `timer: null`. The existing media timer remains active. |
| Last required readiness | Same command/status pair | The last active player's ACK completes readiness, enters `SHOWING`, and supplies the question timer in the status. |
| Timeout | Server → game `MEDIA_DOWNLOAD_STATUS` | Forces active players ready, enters `SHOWING`, and starts the question timer. Status uses `playerId: -1` (`SYSTEM_PLAYER_ID`) and `allPlayersReady: true`; it does not prove successful downloads. |

Only `PlayerRole.PLAYER` participants with `PlayerGameStatus.IN_GAME` belong
to the readiness barrier. Showman and spectators may report readiness but do
not block it. Leaving/disconnecting/restriction can change the active set; use
the existing departure flow rather than inventing additional required roles.

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
- Repeated ACKs while still in the media phase can produce repeated status
  broadcasts. Do not document them as universally deduplicated. ACKs queued
  after completion are covered by the phase guard.
- Selection starts `MEDIA_DOWNLOAD_TIMEOUT`; partial status `timer: null`
  means no replacement timer, not that the running media timer was removed.
- Readiness completion or timeout starts `GAME_QUESTION_ANSWER_TIME`.
- An ACK has no question identifier. The phase guard is not a general guarantee
  against a delayed client callback landing in a later question's media phase.

## Client obligations and known gaps

Intended behavior: prepare the current question's media, ACK after preparation
(or immediately for no files), and keep content/playback gated until the
server completes readiness. Timeout is a fallback, not download verification.

Static inspection at backend PR #441 revision `8348d429` found these unresolved
client gaps; this documentation update does not fix them:

Rechecked at `ef7d56d6`; tracked separately in
[Fix premature question reveal and image readiness ACK (#445)](https://github.com/OpenQuester/OpenQuester/issues/445).
The issue contains slow-media verification steps and required controller/widget coverage;
source inspection is not a manual UI reproduction.

- `GameLobbyController._onQuestionPick` handles `QUESTION_DATA` and immediately
  calls `_showQuestion()`. `GameQuestionLayout` renders question text without a
  readiness condition, even though media widgets have waiting UI.
- `GameQuestionController._onQuestionChange` excludes images from the awaited
  media preparation block but still sends the common readiness ACK afterward.
  `onImageLoaded` sends another ACK later. Thus image readiness can be reported
  before the image is loaded.
- Consequently, neither a ready flag nor a green backend suite establishes
  actual byte completion, hidden text, or synchronized visible playback.

Before marking these gaps resolved, inspect and test the controller and widget
paths together with delayed media preparation, question replacement, and
reconnect. Distinguish source inspection from a reproduced Flutter scenario.

Client source paths (repository-relative):

- `client/apps/client/lib/src/features/game_lobby/controllers/game_lobby_controller.dart`
- `client/apps/client/lib/src/features/game_question/controllers/game_question_controller.dart`
- `client/apps/client/lib/src/features/game_question/view/game_question_layout.dart`
- `client/apps/client/lib/src/features/game_question/view/game_question_file.dart`

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
not Flutter downloading, content hiding, or playback. Keep those evidence
boundaries explicit in bug reports and release claims.

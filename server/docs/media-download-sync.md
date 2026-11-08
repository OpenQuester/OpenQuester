# Media download coordination

This reference covers the direct `CHOOSING -> MEDIA_DOWNLOADING` entry in a
regular round. Secret transfer, stake bidding (including everyone-stake), final
questions and already-active legacy questions without transition metadata keep
their separate entry paths.

The server coordinates reported readiness, not file transfers. Data delivery,
readiness, the opening animation and playback are distinct boundaries.

## Current Socket.IO contract

No new event or question state is introduced. `QUESTION_DATA` delivers
role-filtered content and links in `MEDIA_DOWNLOADING`, with optional
`questionTransition: { timer, mediaReady, timedOut? }`. The opening uses the
existing `GameStateTimerDTO`; `timedOut` records the durable media-timeout fallback.
The same metadata travels in media statuses, snapshots and pause/unpause payloads.

- Selection starts `timer:question-transition:{gameId}` at 1550 ms, alongside
  the ordinary 30-second media timer when files exist.
- Without files, `QUESTION_DATA.timer` is null, media is ready immediately,
  and clients neither preload nor send ACKs. Only the opening timer releases play.
- `MEDIA_DOWNLOADED` reports readiness and optional measured media lengths.
  Statuses with `allPlayersReady: true` and `timer: null` still leave the server
  in `MEDIA_DOWNLOADING`. They may include the prepared content plan, frozen at zero.
- Release uses the existing `MEDIA_DOWNLOAD_STATUS`, with the question timer,
  content plan, null transition metadata and system player ID. Only this release
  enters `SHOWING`; no second `QUESTION_DATA` is sent.
- ACKs outside the media phase are successful no-ops. Duplicate ACKs inside it
  may repeat statuses, but do not extend the closing fade or release twice.

Readiness waits for connected PLAYERs captured at selection, including no-risk
viewers who cannot answer. Late arrivals and promoted spectators do not enter
this roster. Eligible reconnecting viewers preload again. With an originally
empty roster, the solo showman must prepare media; spectators cannot release it.
`questionTransition.mediaEligiblePlayerIds` exposes that captured roster so a
late join cannot cancel the showman's preload or introduce another accepted loader.
The field is optional for compatibility with active preparations from older servers.
Departure removes a participant from the waiting set. The media timeout forces
readiness and keeps it forced through reconnect during the closing fade.

## Opening timer and lifecycle

The opening deadline is `max(selection + 1550 ms, readiness + 300 ms)`.
The final 300 ms remains available after slow readiness. Once both conditions
hold, the content timer starts 200 ms ahead for delivery, making a warm question
start at selection + 1750 ms. Redis TTL includes that 200 ms lead.

ACK, roster-change, unpause and expiration paths use the shared domain barrier
and queued `GameActionExecutor` transitions. Opening expiration never forces
media readiness; only the media timeout does. Known active auxiliary keys are
handled explicitly; saved pause keys remain inactive. Replacement, stale and
duplicate expiration actions cannot release a newer question.

Pause saves the elapsed opening clock in the game and deletes its running key.
ACKs may update readiness while paused, but cannot start playback. Resume rearms
both remaining clocks. A snapshot during an opening restores its remainder; a
snapshot after release does not replay it. Exit, skip, round/game completion
and deletion clear the auxiliary key and metadata. Single-instance restart
recovery also restores transition-only text preparation to a safe paused state.

## Client obligations

Prepare files before ACK (including image decoding). Text-only gated questions
send no readiness command. Physical readiness without a question timer must not
start playback. The first content frame can mount frozen during the closing
fade; playback and buzzer availability follow the released shared timer.
Reduced motion changes the animation, not the deadline. Editor playtests use
the same barrier and timing. Legacy active questions retain their prior flow
until the next applicable pick.

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
ACK**, partial readiness, the independent opening barrier, completion/timeout, and exact
relevant event counts. Explicit question-entry waits account for the transition;
the ordinary 1500 ms event budget is unchanged.
A correct `QUESTION_DATA` with an already-`SHOWING` state must fail.

Controlled helper self-tests prove assertions reject injected defects; they
are not evidence of backend health. Backend transport tests prove coordination,
while download, reveal, and playback need browser evidence. Keep those evidence
boundaries explicit in bug reports and release claims.

## Content timeline (question sequencing)

`QuestionContentPlanLogic` preserves the authored wait groups. Each plan item
contains its duration and an optional `startOffsetMs` relative to its step.
A missing offset starts the item at the start of the step. Screen audio and video
serialize when the question disables simultaneous playback. Five or more images
or videos serialize all screen files in that group. Non-waiting background audio
keeps its own start and can carry across steps. The step duration includes the
latest blocking end and any text reading time.

Regular and final readiness combine measured audio/video durations from eligible
clients. Explicit display times take precedence. For the gated direct regular entry, the opening completes before the timer is
scheduled 200 ms ahead. Separate legacy entries retain their 1750 ms start lead. The Redis expiry includes that lead and a pause preserves
any remaining lead. Reconnecting clients use the same timer. Buzzer presses
before its scheduled start are unavailable. Once the timer starts, buzzer timing derives
from the completed plan and reading and choice delays. Final content adds its
duration to the answering timer. Answer reveal uses its own plan and timing.

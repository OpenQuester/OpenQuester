# Media download coordination

This reference covers direct regular-round picks. Secret, stake and final
questions use separate transitions; active legacy questions without
`questionTransition` retain their existing handshake.

The server coordinates **reported readiness**, not file transfers. Data delivery,
readiness and playback are separate boundaries.

## Current Socket.IO contract

Namespace: `/games`. Names below are backend enum members; wire names and
payloads live in [OpenAPI](../../openapi/schema.json).

| Step | Event | State and payload |
| --- | --- | --- |
| Pick | Client → server `QUESTION_PICK` | `{ questionId }`; existing role/phase validation applies. |
| Deliver data | Server → clients `QUESTION_DATA` | Role-filtered data and links in `MEDIA_DOWNLOADING`, with `questionTransition`. The 30-second media timer is null for text-only questions. |
| Readiness | Client `MEDIA_DOWNLOADED` → server `MEDIA_DOWNLOAD_STATUS` | Clients ACK after loading files. Even `allPlayersReady: true` with `timer: null` keeps preparation active. Text-only questions send no ACK. |
| Release | Server → clients `MEDIA_DOWNLOAD_STATUS` | Enters `SHOWING` with the shared question timer, `contentPlan`, null transition metadata and system player ID. No second `QUESTION_DATA`. |
| Media timeout | Same status event | Forces readiness after 30 seconds; the opening deadline still applies. This does not prove successful downloads. |

`questionTransition` carries `{ timer, mediaReady, mediaEligiblePlayerIds?, timedOut? }`
in question data, statuses, snapshots and pause/unpause events. Its roster captures
the original viewers: connected players, including no-risk viewers who cannot
answer. Late arrivals/promoted spectators do not join it; eligible reconnects
preload again, and departures stop blocking. An originally empty roster requires
the solo showman's ACK. Spectators never block readiness. Timeout-forced readiness
survives reconnect during the closing fade.

## Phase guards and timers

- Selection starts `timer:question-transition:{gameId}`. Opening ends at
  `max(pick + 1550 ms, ready + 300 ms)`; its expiration never forces readiness.
- Release schedules content 200 ms ahead. Redis TTL includes this lead;
  buzzing and playback wait for that shared start. Legacy entries use 1750 ms.
- Pause freezes both clocks; ACKs cannot release a paused game. Resume rearms
  the remainder. Rejoin restores preparation without replaying a released opening.
- ACKs outside `MEDIA_DOWNLOADING` are no-ops. Duplicates inside it can repeat
  statuses but cannot extend the fade. A regular ACK has no question ID, so the
  phase guard alone cannot identify an ACK delayed from an older pick.
- Expirations enter the game action queue. Saved pause keys are inactive;
  replacement/stale timer guards remain in the queued use case. Phase exit and
  game deletion clear the opening; restart recovery restores it paused.

## Client obligations

Load every file and decode images before ACK. Failed preparation sends no ACK;
the server timeout provides the fallback. Prepared content stays frozen until
release. Reduced motion preserves timing, and editor playtests share the clock.
See [web rules](../../web/AGENTS.md) for browser resource cleanup.

## Content timeline

`QuestionContentPlanLogic` preserves authored wait groups. `startOffsetMs`
schedules queued files within each step; non-waiting background audio may outlive
it. Explicit display times override the longest eligible client's reported length,
capped at `CONTENT_ITEM_MAX_TIME`; unknown hashes are ignored. The question timer
covers content, buzzer opening and the answer window. Final content extends its
answer window; answer media uses `answerContentPlan` on the reveal timer.
See the [game-state matrix](../../docs/specs/game-state-matrix.md) for playback rules.

## Verification

Follow the [E2E README](../tests/e2e/README.md). Transport tests assert preparation
before ACKs, partial readiness, independent release/timeout, persisted state and
event counts. Helper self-tests prove assertion behavior; transport tests prove
coordination. Actual downloads, content hiding and playback need browser evidence.

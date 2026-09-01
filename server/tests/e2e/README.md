# E2E Test Lifecycle Rules

- Use `ServerTestHarness` for new E2E suites that need a running server.
- Exercise the real HTTP and Socket.IO transports through `serverUrl`.
- All async waits must be named and bounded.
- Timeout failures must include the operation or event, timeout duration, and actor/socket context.
- Close Socket.IO clients before stopping the harness.
- After each transport scenario, call `harness.resetState()` only after flow/client cleanup; it
  rejects leaked sockets before clearing Redis so one case cannot contaminate the next.
- Cleanup failures must fail the test run; do not catch and only log them.
- Do not use direct sleeps for readiness, event delivery, or cleanup.
- Do not copy lifecycle setup or teardown code into individual suites.
- Do not add production hot-path instrumentation solely to support tests.
- Use port `0` for new isolated lifecycle tests unless a fixed-port failure path is under test.
- Local test Redis defaults to `127.0.0.1:6380` through `server/compose.yml`. GitHub Actions uses
  its Redis service explicitly through `TEST_REDIS_PORT=6379`.
- PostgreSQL and Redis are required for transport E2E suites. Run focused checks through
  `npm run test:pipeline -- path/to/test.ts --runInBand`.

## Scenario and journal rules

- Use `GameScenario`, `ScenarioActor`, `ScenarioAssertions`, and `EventJournal` for new
  client-perspective game-flow tests.
- Attach every relevant actor socket to the journal before emitting commands.
- Prefer actor methods over raw `socket.emit` in scenario tests.
- Use `scenario.mark()` before a burst of commands when assertions should only inspect new events.
- Follow this sequence for every realtime step: **mark → arm accepted-action probe and event waits →
  emit → await them together → drain → make exact history/state assertions**. Do not use queue drain
  to prove an action was accepted before its atomic enqueue is observed.
- An accepted action is one whose atomic Redis queue enqueue completed successfully. It is not
  merely an entry into `GameActionExecutor.submitAction`.
- Predicate event expectations by actor/payload when the event can be broadcast more than once.
- Journal predicates must be synchronous so record matching remains ordered and waiter registration
  cannot race a payload scan.
- Use `scenario.assert.broadcast(...)` when every actor must receive the same server event.
- Use `scenario.assert.expectOutboundCommandCount(...)` to prove command bursts were actually sent.
- Use exact journal snapshots only after accepted actions, queue, and lock have drained; snapshots
  do not poll or provide synchronization.
- Negative assertions must use bounded no-event waits and should explain the expected quiescence
  window.
- Scenario tests may emit bursts, such as duplicate or concurrent media-download commands, and
  assert the resulting journal history afterwards.
- Actor labels are unique. Reconnect scenarios need an explicit connection generation design instead
  of silently replacing an actor.
- End a successful scenario with `scenario.finish()`. It waits for every tracked event, aggregate,
  derived validation, state assertion, and accepted-action count, so a forgotten promise cannot make
  the test pass.
- End a scenario whose primary test body already failed with `scenario.abort()`. Abort cancels
  pending waits before socket cleanup without replacing the primary failure with derivative
  cancellation errors.
- Track the complete derived or aggregate expectation, not only its underlying event wait.
  Accepted-action probe waits created by `GameScenario` are tracked automatically.

## Flow helper rules

- Use small flow helpers, such as `MediaDownloadFlow`, only after a pattern repeats.
- Flow helpers should express domain actions and assertions; they must not hide important scenario
  intent.
- Keep setup/cleanup in the helper when it removes noise from scenario tests.
- Flow wrappers must call `finish()` only after a successful callback and `abort()` after a callback
  failure.
- A flow helper must surface cleanup failures. If both the scenario and cleanup fail, preserve both
  errors in one aggregate.

## Migration rule

Media Download is the scenario/journal golden contract slice, including readiness, timeout,
duplicate, leave, disconnect, kick, and restriction behavior. Its client contract is explicit:
`QUESTION_PICK` preloads media metadata, `QUESTION_DATA` remains absent while the readiness gate is
closed, and the full question is revealed only after final readiness, timeout, or an equivalent
gate-opening transition. A no-file question preloads an empty file list and auto-reveals without a
client acknowledgement. Keep a backend mismatch red; do not weaken these assertions or reintroduce
media coverage through the legacy socket helpers.

## Static contract checks

`tests/e2e/contracts/SocketActionContracts.test.ts` is a fast wiring guard for the socket action map
and handler registration. It complements, but does not replace, real Socket.IO transport E2E
coverage.

`tests/e2e/contracts/SocketGameTransportPolicy.test.ts` keeps migrated gameplay suites on the shared
lifecycle and rejects copied bootstrap/cleanup, warn-and-skip branches, and hand-written event
timers outside the queue-mechanics stress collectors. It also rejects disabled/focused cases and
catch-all branches that could turn an infrastructure failure into a passing assertion.

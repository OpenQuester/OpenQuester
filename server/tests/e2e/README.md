# E2E Test Lifecycle Rules

## Choose the right layer

| Test behavior                                                                              | Writing mechanism                                                                                            |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| REST endpoints: users, permissions, mute, packages, search, admin logs                     | `ServerTestHarness` + `createHttpTestClient(harness.serverUrl)`                                              |
| Gameplay and hybrid HTTP/Socket.IO behavior, including user notifications and game updates | `SocketGameTestSuite` + `suite.scenario(...)` + `GameScenario` assertions                                    |
| Dedicated media coordination scenarios                                                     | `withMediaDownloadFlow(...)`, which owns a `GameScenario` and its assertions                                 |
| Queue/repository/database/logger internals and harness self-tests                          | Focused unit/integration helpers appropriate to the component; do not pretend these are client E2E scenarios |

The migration covers backend transport E2Es. It does not turn pure domain tests or infrastructure
self-tests into gameplay scenarios, and it does not add Flutter/browser E2E coverage.

## Shared lifecycle

- Use `ServerTestHarness` for E2E suites that need a running server, either directly for HTTP or
  through `SocketGameTestSuite` for realtime scenarios.
- Exercise the real HTTP and Socket.IO transports through `serverUrl`.
- All async waits must be named and bounded.
- Timeout failures must include the operation or event, timeout duration, and actor/socket context.
- Close Socket.IO clients before stopping the harness.
- After each transport scenario, call `harness.resetState()` only after flow/client cleanup; it
  rejects leaked sockets before clearing Redis so one case cannot contaminate the next.
- Cleanup failures must fail the test run; do not catch and only log them.
- Internal integration tests that call `bootstrapTestApp` directly must finish with
  `teardownTestAppResources(cleanup, testEnv)`, which closes the app before its shared Redis,
  database, and logger environment and preserves failures from both stages.
- Use `runAndWaitForEvent` when a multi-step operation is expected to produce a terminal event; it
  arms the listener first and cancels that wait if an earlier step fails.
- A terminal timeout must not hide a prerequisite failure from that operation. The terminal keeps
  its original deadline; the operation has that requested budget plus one shared event-wait budget
  to settle and report its own failure first. A late terminal event still fails, and a hung
  operation fails its named operation deadline.
- Await every event assertion. The shared event utility observes and cancels unfinished waits before
  client cleanup so a primary failure cannot leak listeners, timers, or secondary timeout noise.
  Lint rejects floating or unused waits, and the transport policy rejects explicit `void` escapes.
- Use `withEventJournal` for direct journal-backed assertions so scenario and disposal failures are
  both preserved.
- Do not use direct sleeps for readiness, event delivery, or cleanup.
- Do not copy lifecycle setup or teardown code into individual suites.
- Do not add production hot-path instrumentation solely to support tests.
- Use port `0` for new isolated lifecycle tests unless a fixed-port failure path is under test.
- Local test Redis defaults to `127.0.0.1:6380` through `server/compose.yml`. GitHub Actions uses
  its Redis service explicitly through `TEST_REDIS_PORT=6379`.
- PostgreSQL and Redis are required for transport E2E suites. Run focused checks through
  `npm run test:pipeline -- path/to/test.ts --runInBand`.

## HTTP test rules

- Start the harness with `{ apiPort: 0 }`; always use its resolved `serverUrl`, never an environment
  port guess or `supertest(app)`.
- Create `http = createHttpTestClient(harness.serverUrl)` in `beforeEach`. The stateless client
  supports `.get`, `.post`, `.put`, `.patch`, `.delete`, `.head`, and `.options`, followed by the
  existing `.query`, `.set`, `.send`, and `.expect` request assertions.
- Every request has a deadline covering both response headers and the complete response body.
  Transport errors name the HTTP method and URL. Do not disable deadlines to hide a stalled request.
- Supply authentication explicitly with `.set("Cookie", cookie)`. The client does not retain a
  cookie jar: logging in as an admin must not accidentally authenticate a later guest request.
- Await each request and assert its status and relevant response fields. Keep persistence checks
  when they prove a separate observable effect; do not replace HTTP calls with controller calls.
- Per-case database fixtures remain suite-owned; finish them before `harness.resetState()`. Call
  `await harness?.stop()` in `afterAll`, including after partial setup failure.
- HTTP actions inside a realtime scenario use the same bounded client. Arm the corresponding
  scenario event expectation before the HTTP mutation.

## Scenario and journal rules

- Wrap each gameplay or hybrid test body in `await suite.scenario(async (scenario) => { ... })`. The
  wrapper finishes successful scenarios, aborts failed ones, and preserves assertion/disposal
  failures. Use `await suite?.reset()` in `afterEach` and `await suite?.stop()` in `afterAll`.
- Obtain actors with `scenario.actor(socket, optionalLabel)` and issue commands through
  `scenario.actor(socket).emit(...)`. Actor identity belongs to a socket connection; reconnecting
  creates a new generation instead of letting old events satisfy new assertions.
- Suite-owned clients are attached to the active scenario automatically. Attach any separately
  created relevant actor socket before emitting commands.
- Use `scenario.waitForEvent`, `waitForEventMatching`, `waitForNoEvent`, `emitAndWaitForEvent`, and
  `runAndWaitForEvent` for bounded expectations. Event waits inspect only records after
  registration; an older event with the same name cannot satisfy a new wait.
- Shared game-flow helpers route their internal waits through the active scenario too; using a
  helper does not opt out of journal-backed assertions or failure ownership.
- Use `ScenarioAssertions` for exact broadcasts, counts, history, and state assertions. Use
  `scenario.collectEvents` or `collectSocketEvents` for bounded multi-event collections instead of
  copied `.on`, `.once`, or timer-based collectors.
- Use `scenario.mark()` before a burst of commands when assertions should only inspect new events.
- For queued-action history/state checks, follow: **mark → arm accepted-action probe and event waits
  → emit → await them together → drain → make exact history/state assertions**. Do not use queue
  drain to prove an action was accepted before its atomic enqueue is observed.
- An accepted action is one whose atomic Redis queue enqueue completed successfully. It is not
  merely an entry into `GameActionExecutor.submitAction`.
- Predicate event expectations by actor/payload when the event can be broadcast more than once.
- Journal predicates must be synchronous so record matching remains ordered and waiter registration
  cannot race a payload scan.
- Use `scenario.assert.broadcast(...)` when every actor must receive the same server event.
- Use `scenario.assert.expectOutboundCommandCount(...)` to prove command bursts were actually sent.
- Use exact journal snapshots only after accepted actions, queue, and lock have drained; snapshots
  do not poll or provide synchronization.
- Negative assertions name their recipients: `noInbound({ actor, ... })` or
  `noInboundMany({ actors, ... })`. Groups must be non-empty and contain unique, scenario-owned
  actors. Never filter recipients by `socket.connected`: an unexpected disconnect must fail.
- Live positive and negative waits require a connected actor from the current connection generation.
  Disconnect, connect error, or replacement rejects its pending waits (and a group's aggregate). For
  history after disconnect, use `records`/snapshot, not a live wait.
- Arm an expected `disconnect` before triggering it; the journal records that event before rejecting
  the actor's other waits. Negative windows default to 100 ms, but an explicit positive, finite
  `durationMs` is observed in full, not truncated to the default.
- Scenario tests may emit bursts, such as duplicate or concurrent media-download commands, and
  assert the resulting journal history afterwards.
- Actor labels are unique. `scenario.actor(...)` manages reconnect generations; do not manually
  register a replacement using an existing label.
- The suite wrapper ends a successful scenario with `scenario.finish()`. It waits for every tracked
  event, aggregate, derived validation, state assertion, and accepted-action count, so a forgotten
  promise cannot make the test pass.
- The suite wrapper ends a scenario whose primary test body already failed with `scenario.abort()`.
  Abort cancels pending waits before socket cleanup without replacing the primary failure with
  derivative cancellation errors.
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

## Current media protocol and coverage boundary

The contract follows [media download synchronization](../../docs/media-download-sync.md):
outgoing `QUESTION_PICK` produces incoming `QUESTION_DATA` containing question/file data and the
media timer. Before **any** readiness ACK, tests assert persisted `MEDIA_DOWNLOADING` and its active
timer. A correct data payload with an already `SHOWING` state must fail; data arrival alone is not
proof of the readiness barrier.

Partial player ACKs produce `MEDIA_DOWNLOAD_STATUS` with `allPlayersReady: false` and `timer: null`;
the active media timer remains. The final active player's ACK (or media timeout) completes readiness,
produces the question timer in the status, and enters `SHOWING`. Showman and spectators do not block
readiness. No-file questions use the same backend handshake, with immediate simulated client ACKs.
There is no inbound preload `QUESTION_PICK`, nor a second `QUESTION_DATA` on readiness completion.

Dedicated scenarios preserve duplicate, concurrent, leave, disconnect, kick, restriction, stale
timeout, and queue behavior. Shared payload checks compare common fields and file links; showman-only
answers are checked separately, never by requiring different roles' full payloads to be equal.
Controlled infrastructure self-tests prove that omitted phases, files, or correct timers fail the
same helper that accepts a correct flow. Those self-tests are not evidence of backend health.

Media tests supply file metadata and simulate clients sending `MEDIA_DOWNLOADED`. They verify server
coordination, event order, readiness gating, and timers. They do not download file bytes, execute
Flutter media loading, or prove that the UI hides or plays media at the right time. Those claims
require client-side coverage. Actual game-rule uncertainty must be resolved with the user.

## Static contract checks

`tests/e2e/contracts/SocketActionContracts.test.ts` is a fast wiring guard for the socket action map
and handler registration. It complements, but does not replace, real Socket.IO transport E2E
coverage.

`tests/e2e/contracts/SocketGameTransportPolicy.test.ts` keeps migrated gameplay suites on the shared
scenario/lifecycle and rejects copied bootstrap/cleanup, warn-and-skip branches, and hand-written
event timers. It also rejects disabled/focused cases and catch-all branches that could turn an
infrastructure failure into a passing assertion.

`tests/e2e/contracts/HttpTransportPolicy.test.ts` keeps HTTP and hybrid endpoint suites on their
harness/scenario lifecycle and rejects direct unbounded HTTP requests and guessed server ports.

`tests/e2e/contracts/TestLifecyclePolicy.test.ts` keeps internal direct test-app callers on the
ordered teardown helper and rejects teardown failures that are caught and only logged.

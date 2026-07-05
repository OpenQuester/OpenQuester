# E2E Test Lifecycle Rules

- Use `ServerTestHarness` for new E2E suites that need a running server.
- Exercise the real HTTP and Socket.IO transports through `serverUrl`.
- All async waits must be named and bounded.
- Timeout failures must include the operation or event, timeout duration, and actor/socket context.
- Close Socket.IO clients before stopping the harness.
- Cleanup failures must fail the test run; do not catch and only log them.
- Do not use direct sleeps for readiness, event delivery, or cleanup.
- Do not copy lifecycle setup or teardown code into individual suites.
- Do not add production hot-path instrumentation solely to support tests.
- Use port `0` for new isolated lifecycle tests unless a fixed-port failure path is under test.

## Scenario and journal rules

- Use `GameScenario`, `ScenarioActor`, `ScenarioAssertions`, and `EventJournal` for new client-perspective game-flow tests.
- Attach every relevant actor socket to the journal before emitting commands.
- Prefer actor methods over raw `socket.emit` in scenario tests.
- Use `scenario.mark()` before a burst of commands when assertions should only inspect new events.
- Predicate event expectations by actor/payload when the event can be broadcast more than once.
- Use `scenario.assert.broadcast(...)` when every actor must receive the same server event.
- Use `scenario.assert.expectOutboundCommandCount(...)` to prove command bursts were actually sent.
- Negative assertions must use bounded no-event waits and should explain the expected quiescence window.
- Scenario tests may emit bursts, such as duplicate or concurrent media-download commands, and assert the resulting journal history afterwards.

## Driver rules

- Route state/action assertions through `ScenarioGameDriver` instead of calling old socket utilities directly from scenario tests.
- The current driver is `SocketGameScenarioDriver`, which adapts the existing Node/Socket.IO helpers.
- Keep the driver interface small so future game-engine implementations can reuse the same scenario tests.

## Flow helper rules

- Use small flow helpers, such as `MediaDownloadFlow`, only after a pattern repeats.
- Flow helpers should express domain actions and assertions, not hide important test intent.
- Keep setup/cleanup in the helper when it removes noise from scenario tests.

## Migration rule

Do not migrate the whole socket test suite at once. Use the scenario/journal layer first for Media Download, then migrate other critical flows once the pattern is stable.

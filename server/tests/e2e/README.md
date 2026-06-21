# E2E Test Lifecycle Rules

- Use `ServerTestHarness` for new E2E suites that need a running server.
- Exercise the real HTTP and Socket.IO transports through `serverUrl`.
- Do not copy server setup or teardown logic into individual suites.
- Cleanup failures must fail the test run; do not catch and only log them.
- Do not use arbitrary sleeps for server readiness or cleanup.
- Use port `0` for new isolated lifecycle tests unless a fixed-port failure path is under test.
- The event journal/scenario DSL belongs to a later phase.
- Do not migrate existing game tests in this phase.

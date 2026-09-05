---
name: backend-e2e
description: Use when writing, migrating, or reviewing OpenQuester backend HTTP, Socket.IO, hybrid, or dedicated media E2E tests and their scenario helpers. Not for pure domain unit tests, Flutter UI tests, or merely running existing tests.
---

# Backend transport E2E

## Read and choose the boundary

Read `server/AGENTS.md`, `server/tests/e2e/README.md`, and the nearest existing
suite before editing. The E2E README owns the APIs, examples, lifecycle, and
policy rules; do not create a second test DSL. Use `backend-test-runner` when
executing tests and `backend-smoke-tests` to decide whether a behavior change
needs a new case.

- HTTP: `ServerTestHarness` and `createHttpTestClient(harness.serverUrl)`.
- Gameplay/hybrid: `SocketGameTestSuite` with the entire case returned or
  awaited through `suite.scenario(...)`.
- Dedicated media: `withMediaDownloadFlow(...)`.
- Infrastructure self-tests: controlled sockets/promises/timers are appropriate
  here, not substitutes for real transport, Redis queues, or PostgreSQL in E2E.

## Preserve causal evidence

1. Name the observable rule and inspect the current handler, payload types, and
   relevant spec. Separate the current wire protocol from desired behavior.
2. Register actors, mark history, and arm event waits and accepted-action probes
   before emitting. For queued actions, acceptance means successful atomic Redis
   enqueue, not entry into `submitAction` or an empty queue.
3. Await acceptance and relevant events, drain actions, then assert exact counts,
   payloads, and persisted state. Preserve FIFO assertions for queue scenarios.
4. Await and track the complete derived/aggregate assertion, including `.then`
   validation. Public async helpers need internal deadlines and cancellation;
   tracking a never-settling promise is not a deadline.
5. Let the wrapper finish or abort before helper detachment, client cleanup,
   state reset, and harness stop. Preserve primary failures and cleanup failures.

Negative assertions require explicit recipients: `noInbound({ actor, ... })`
or `noInboundMany({ actors, ... })`. Empty/duplicate groups, foreign/stale actors,
and unexpected disconnects must fail. Never filter by `socket.connected`.
Explicit finite positive windows must be observed fully. Arm an intentional
disconnect first; use history after disconnection and a new actor generation
after reconnect.

## Media-specific proof

Read `server/docs/media-download-sync.md`. For normal regular-round questions, outgoing
`QUESTION_PICK` receives `QUESTION_DATA`, not inbound preload `QUESTION_PICK`.
Before ACKs, assert the selected media fixture, files/links, persisted
`MEDIA_DOWNLOADING`, and media timer. Partial player readiness must retain that
phase; the last required ACK or timeout completes readiness via
`MEDIA_DOWNLOAD_STATUS`, not a second `QUESTION_DATA`. Showman/spectators do not
block; no-file questions use immediate simulated client ACKs.

A valid payload with already-`SHOWING` state must fail the helper. When changing
critical infrastructure, keep both a controlled correct-flow test and a
controlled-defect regression using the same assertion path. Backend E2E does
not prove file-byte downloading, truthful Flutter ACK timing, content hiding,
or playback synchronization.

## Verify and report

Run changed helper/policy self-tests first, then relevant real transport cases
through `test:pipeline`. Use the README's CI repeatability procedure for broad
reliability work, not retry-until-green. Do not add skips, focused tests,
`.failing`, transport `.concurrent`, sleeps, longer timeouts, or policy exceptions
to conceal a failure. New transport suites must be classified by the policy.

Record unique failures by full title, expected/actual result, whether the main
behavior was reached, and environment / infrastructure / wrong test expectation /
backend-rule mismatch. Old failure counts are not an allowlist. Preserve existing
behavioral cases or document their replacement. Test-only authority does not
permit product fixes; ask when game rules or scope need a user decision.

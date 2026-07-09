# PR #441 E2E reliability stabilization execution plan

> Temporary implementation handoff for PR #441. This document is deliberately
> detailed so a model starting in a fresh chat can execute the work without the
> earlier conversation. It is not a permanent architecture or product spec.
> Current branch code and scoped `AGENTS.md` files outrank this plan when they
> disagree. Remove or archive this handoff after the work is complete so it does
> not become stale agent guidance.

## 1. Mission

Finish and stabilize the backend Media Download client-contract E2E migration
in PR #441 before starting any Buzzer/Answer scenario migration.

The implementation must eliminate the remaining false-green, flaky, cleanup,
and test-environment safety risks in the new scenario/journal/driver layer. It
must then consolidate Media Download coverage into one reliable golden suite.

This is a test-infrastructure reliability task, not a production gameplay
feature.

Work categories:

- `bug_fix`: unsafe Redis cleanup, pre-enqueue action waits, transient queue
  drain detection, cross-socket ordering assumptions, hidden cleanup failures,
  and teardown errors that mask the root failure.
- `refactor_only`: journal/action-probe lifecycle hardening and removal of
  duplicate Media Download E2E coverage while preserving production behavior.

## 2. Verified baseline and PR context

The following was verified on 2026-07-09. Recheck it before implementation
because the branch may have moved.

- Repository: `OpenQuester/OpenQuester`
- PR: `#441`
- PR title: `refactor: continue backend E2E reliability phase 2`
- Branch: `refactor/refactor-tests-reliability-phase-2`
- Base: `main`
- PR state: open, draft, mergeable
- Verified head: `a2488efde81994973f75031ef3009261643cc3b8`
- Baseline diff: 14 files, approximately 1,659 additions and 5 deletions
- Baseline GitHub result: server lint, build, and all 68 suites / 585 tests
  passed; the full Jest run took approximately 220 seconds.
- Baseline local tracked worktree: clean.
- Existing unrelated untracked paths: `.codex_tmp/` and `shop/`. They belong to
  the user and must not be edited, deleted, staged, or inspected beyond what is
  necessary to avoid touching them.

The green baseline is useful but does not prove the POC is safe or deterministic.
The problems below are either not exercised by the current tests or can pass by
timing luck.

## 3. Why Buzzer work is explicitly blocked

Do not add Buzzer, answer-race, reconnect, or new gameplay scenarios in this
slice. The Media Download POC currently has these foundation gaps:

1. `server/tests/utils/utils.ts` implicitly reads ordinary `server/.env` Redis
   host/credentials, while test cleanup deletes every key in the selected Redis
   DB. A developer `.env` can therefore point destructive cleanup at a remote
   or non-test Redis database.
2. `RedisTestUtils.clearAllKeys()` warns and continues when keys remain, allowing
   state leakage into later race-sensitive tests.
3. `SocketGameTestEventUtils` emits its `action-submitted` observation before
   `GameActionExecutor.submitAction()` reaches the atomic Redis enqueue. A burst
   test can report all actions as submitted while enqueues are still in flight.
4. `waitForActionsComplete()` currently checks only lock state and queue length.
   It can observe an unlocked, temporarily empty queue between concurrent
   enqueues and resolve too early.
5. `EventJournal` leaves pending timers/waits alive when `GameScenario.dispose()`
   only detaches listeners. A primary failure can be followed by delayed
   rejections or open handles from abandoned expectations.
6. The two-player happy path assumes player 0 reaches Redis before player 1 even
   though commands use independent Socket.IO connections. The queue guarantees
   FIFO by Redis arrival, not by JavaScript emit order across sockets.
7. Media status predicates check only `playerId` and `allPlayersReady`, ignoring
   required `mediaDownloaded` and `timer` fields.
8. Whole-game broadcasts are not asserted for spectators.
9. The 100 ms no-timeout assertion cannot prove cancellation/replacement of a
   10-second media timer.
10. The new suite is additive: the large legacy Media Download suite remains,
    so this is not yet a completed migration.
11. Cleanup rules say failures must fail tests, but the inherited client cleanup
    helper catches and only logs errors.
12. If harness startup fails, `afterAll` calls `stop()` on an undefined harness,
    adding a secondary error that obscures the real PostgreSQL/Redis failure.

Buzzer/Answer race migration is the next strategic flow only after every
acceptance gate in this document passes and the Media foundation is reviewed.

## 4. Authority, required skills, and reading order

At the beginning of the implementation turn, use these repository skills:

- `.agents/skills/project-assurance/SKILL.md`
- `.agents/skills/backend-maintenance/SKILL.md`
- `.agents/skills/docs-upkeep/SKILL.md`

Read these sources completely before editing:

1. `AGENTS.md`
2. `server/AGENTS.md`
3. `docs/agent/02-source-of-truth.md`
4. `docs/agent/03-verification-matrix.md`
5. `docs/agent/04-docs-drift-policy.md`
6. `docs/agent/05-decision-navigation.md`
7. `server/tests/e2e/README.md`
8. `server/docs/game-action-executor.md`
9. `server/docs/media-download-sync.md`
10. `docs/specs/game-state-matrix.md`

Then inspect the current versions of the implementation files listed in
Section 7. Do not assume their contents still match the verified head.

Source priority when facts disagree:

1. Current code and tests in the target branch.
2. Nearest scoped `AGENTS.md`.
3. Relevant specs and ADRs.
4. Deep server docs.
5. This temporary plan.

If current code has materially changed, update the approach to preserve the
intent and invariants below. Do not restore older code just to match this plan.

## 5. Scope and non-goals

### In scope

- Test-only Redis target resolution and destructive-cleanup safety.
- Fail-closed Redis and Socket.IO client cleanup.
- Test-only observation of accepted Redis queue enqueues.
- Correct queue-drain detection while enqueues are in flight.
- EventJournal and GameScenario lifecycle/cancellation behavior.
- Exact, actor-aware event/action assertions.
- Media Download flow setup, cleanup, payload, recipient, state, and timer
  assertions.
- Replacement of duplicated legacy Media Download E2E coverage.
- CI environment-variable correctness.
- Canonical documentation for the changed E2E workflow.

### Out of scope

- Production changes to Media Download behavior.
- Production instrumentation or test hooks.
- Any edit to `MediaDownloadedUseCase`, production queue/lock/timer code, or
  state-machine handlers solely to make tests easier.
- New Socket.IO events or payload fields.
- OpenAPI/schema or generated Dart changes.
- Client/Flutter changes.
- Buzzer, answer-race, reconnect, or final-round migration.
- Media invalid-action polish: spectator emitting `MEDIA_DOWNLOADED`, wrong
  phase, unauthenticated actor, or post-`SHOWING` duplicates.
- Architecture-wide replacement of the Node-specific scenario driver.
- Remote shared Redis support for tests.
- New third-party dependencies.

If implementation appears to require one of these non-goals, stop and report
the evidence instead of silently expanding scope.

## 6. Non-negotiable invariants

### Production invariants

- Preserve the current public Socket.IO event names and payload shapes.
- Preserve the queued `GameActionExecutor` path for game-changing actions.
- Preserve current Media Download state transitions and timer durations.
- Preserve current behavior where every accepted duplicate
  `MEDIA_DOWNLOADED` action produces a status broadcast.
- Do not add test-only branches, hooks, counters, or logging to production code.

### Test sequencing invariant

Every realtime scenario step must follow this order:

```text
take event mark
  -> arm accepted-action probe and event expectations
  -> emit client command(s)
  -> await accepted actions and required events together
  -> wait for in-flight enqueues + queue + lock to drain
  -> assert exact action/event history
  -> assert persisted state/timer/readiness
  -> perform only explicitly bounded negative assertions when still needed
```

Never call queue drain before the expected actions are known to have completed
their atomic enqueue.

### Timing invariant

- Do not use arbitrary sleeps or `setTimeout` for transport/timer E2E
  synchronization.
- Do not increase timeouts to make a flaky test pass.
- Use `TestUtils.expireTimer()` or `expireTimerAndWaitForAction()` for game
  timers.
- Jest fake timers are allowed only for isolated deterministic unit tests, and
  must be restored in `afterEach`.

### Promise/lifecycle invariant

- Every expectation promise created by a test must be awaited through
  `Promise.all` or registered with scenario disposal.
- A first failure must not leave later expectation timers alive.
- Cleanup failures must remain visible and must not replace the original test
  failure without preserving both errors.

### Multi-socket invariant

- Never infer server arrival order from the order in which two different
  Socket.IO clients call `emit`.
- Assert order-independent identities for concurrent actors, while still
  asserting the server-observed event sequence (for example false readiness
  before true readiness).

## 7. Files to inspect before changing anything

### Current PR scenario layer

- `server/tests/e2e/scenario/EventJournal.ts`
- `server/tests/e2e/scenario/EventJournal.test.ts`
- `server/tests/e2e/scenario/ScenarioActor.ts`
- `server/tests/e2e/scenario/GameScenario.ts`
- `server/tests/e2e/scenario/ScenarioAssertions.ts`
- `server/tests/e2e/scenario/ScenarioGameDriver.ts`
- `server/tests/e2e/scenario/SocketGameScenarioDriver.ts`

### Current PR Media layer

- `server/tests/e2e/flows/MediaDownloadScenario.test.ts`
- `server/tests/e2e/flows/media-download/MediaDownloadFlow.ts`
- `server/tests/socket/game/MediaDownloadFlow.test.ts`
- `server/tests/socket/game/GameLockAndQueueMechanics.test.ts`

### Shared test infrastructure

- `server/tests/socket/game/utils/SocketGameTestEventUtils.ts`
- `server/tests/socket/game/utils/SocketGameTestLobbyUtils.ts`
- `server/tests/socket/game/utils/SocketIOGameTestUtils.ts`
- `server/tests/utils/TestUtils.ts`
- `server/tests/utils/TestTimeouts.ts`
- `server/tests/utils/RedisTestUtils.ts`
- `server/tests/utils/utils.ts`
- `server/tests/TestEnvironment.ts`
- `server/tests/e2e/harness/ServerTestHarness.ts`

### Production behavior to verify but not edit for test convenience

- `server/src/application/executors/GameActionExecutor.ts`
- `server/src/application/services/queue/GameActionQueueService.ts`
- `server/src/application/usecases/game/MediaDownloadedUseCase.ts`
- `server/src/application/services/timer/TimerExpirationService.ts`
- `server/src/domain/logic/question/MediaDownloadLogic.ts`
- `server/src/domain/state-machine/handlers/regular-round/ChoosingToMediaDownloadingHandler.ts`
- `server/src/domain/state-machine/handlers/regular-round/MediaDownloadingToShowingHandler.ts`
- `server/src/domain/types/socket/events/game/MediaDownloadStatusEventPayload.ts`
- `server/src/domain/constants/game.ts`

### CI and documentation

- `.github/workflows/test.yml`
- `server/package.json`
- `server/scripts/test/runPipelineTests.mjs`
- `server/compose.yml`
- `server/tests/e2e/README.md`
- `server/AGENTS.md`
- `.agents/skills/project-assurance/SKILL.md`

## 8. Phase 0: preflight and baseline protection

Before edits:

- Run `git status --short --branch`.
- Record `git rev-parse HEAD` and `git branch --show-current`.
- Inspect `git diff --stat main...HEAD` and changed filenames.
- Confirm PostgreSQL and Redis availability before running infrastructure tests.
- Do not start by deleting or moving tests.
- Run the current focused unit-only baseline when possible:

```text
npx jest tests/e2e/scenario/EventJournal.test.ts \
  tests/e2e/contracts/SocketActionContracts.test.ts \
  --runInBand --detectOpenHandles
```

If tracked changes from another actor/user are present, preserve them and work
around them. Ask only if the required edits directly overlap and cannot be
safely reconciled.

## 9. Phase 1: explicit and safe test Redis targeting

### 9.1 Remove ordinary `.env` discovery

In `server/tests/utils/utils.ts`:

- Remove `dotenv`, `path`, `DotenvParseOutput`, cached local overrides, and the
  `getLocalEnvOverrides()` / `isCiEnv()` mechanism.
- Tests must not read Redis settings from ordinary `server/.env`.
- Tests must not inherit ordinary `REDIS_HOST`, `REDIS_PORT`,
  `REDIS_USERNAME`, `REDIS_PASSWORD`, or `REDIS_DB_NUMBER` from a shell that may
  be configured for a development/production server.

Resolve only these test-specific inputs:

```text
TEST_REDIS_HOST
TEST_REDIS_PORT
TEST_REDIS_USERNAME
TEST_REDIS_PASSWORD
TEST_REDIS_DB_NUMBER
```

Translate them into the runtime `REDIS_*` variables consumed by `RedisConfig`.

Defaults:

```text
TEST_REDIS_HOST     -> 127.0.0.1
TEST_REDIS_PORT     -> 6380
TEST_REDIS_USERNAME -> empty
TEST_REDIS_PASSWORD -> empty
TEST_REDIS_DB_NUMBER -> getTestRedisDb() (per worker)
```

`6380` is intentional: `server/compose.yml` maps host
`127.0.0.1:6380` to container port `6379`. GitHub Actions will explicitly use
port `6379` for its service container.

Always overwrite the runtime `REDIS_*` values in `setTestEnvDefaults()`. Do not
use `||=` for these settings. Leave the existing PostgreSQL resolution behavior
unchanged in this task.

### 9.2 Guard destructive Redis cleanup

Before `RedisTestUtils.clearAllKeys()` issues `KEYS` or `DEL`, validate the
resolved client target rather than trusting only environment strings.

Required conditions:

- Both `ENV` and `NODE_ENV` are `test`.
- Resolved host is exactly `127.0.0.1`, `localhost`, or `::1`.
- Resolved database number is an integer in `1..14`.

Reject before the first Redis key command when any condition fails.

The error must include:

- safe host/port/DB identification;
- which safety condition failed;
- no username/password or connection URL containing credentials.

Do not add an `ALLOW_REMOTE_REDIS` escape hatch. Remote/shared test Redis needs
a separately designed namespace and cleanup policy and is out of scope.

Extract target parsing/validation into a pure testable function. Keep the
existing `RedisTestUtils.clearAllKeys()` facade so call sites do not need a
large migration.

### 9.3 Make residual keys fail the responsible test

Keep the repeated delete loop because Compose renames/disables `FLUSHDB` and
`FLUSHALL`.

After the final cleanup attempt:

- Fetch remaining keys once.
- If none remain, return.
- Otherwise throw a diagnostic error with target host/port/DB, total remaining
  key count, attempt count, and at most the first 20 key names.
- Do not call `console.warn` and continue.

For unit testing, extract the cleanup loop so a fake/injected Redis subset can
implement `keys` and `del`. Do not require a real Redis process for the safety
unit tests.

### 9.4 Required tests for this phase

Create `server/tests/utils/TestEnvironmentSafety.test.ts` covering:

- Default resolution produces `127.0.0.1:6380` and a worker test DB.
- Every `TEST_REDIS_*` value overrides its default.
- Ordinary `REDIS_*` and `.env` values cannot redirect test setup.
- DB 0 is rejected before `keys()` is called.
- A non-loopback host is rejected before `keys()` is called.
- Non-test ENV/NODE_ENV is rejected.
- Successful cleanup deletes keys until none remain.
- Persistent writers/remaining keys cause a thrown diagnostic error.
- Diagnostics never contain the configured password.

Checkpoint: run this new unit test before proceeding.

## 10. Phase 2: strict Socket.IO client cleanup

Refactor `SocketGameTestLobbyUtils.cleanupGameClients()` so cleanup failures
cannot be hidden and sockets cannot remain open just because a pre-cleanup wait
failed.

Required algorithm:

1. Build the complete socket list immediately:
   showman, players, spectators.
2. Maintain an ordered `Error[]` for cleanup failures.
3. Attempt pre-cleanup action drain. Record failure but continue.
4. Attempt server-session discovery for every socket. Record failures but
   continue.
5. If session discovery succeeds for at least one socket, arm the expected
   disconnect-action wait before closing sockets.
6. Close every client socket exactly once. Wrap each close so one failure does
   not prevent the others from closing.
7. Await the armed disconnect-action wait when present.
8. Attempt the final action drain.
9. Throw one `AggregateError` when any step failed; otherwise resolve.

Do not keep the existing `try/catch` that only logs. Reuse an existing
`collectFailure` / `throwIfFailed` helper if one is already suitable; otherwise
add a small test-only helper close to the cleanup code. Do not create a new
cross-project error framework.

Add focused tests proving:

- All sockets close when the initial drain throws.
- All sockets close when session inspection throws.
- One socket close failure does not prevent other closes.
- Disconnect-action wait failure propagates.
- Final drain failure propagates.
- Multiple failures are preserved in one aggregate.
- Successful cleanup remains unchanged.

## 11. Phase 3: observe accepted enqueues, not submit entry

### 11.1 Keep instrumentation test-only

All instrumentation belongs in
`server/tests/socket/game/utils/SocketGameTestEventUtils.ts` and scenario test
adapters. Read the production queue/executor to identify the current method,
but do not modify production code to expose test hooks.

Production currently accepts an action through:

```text
GameActionExecutor.submitAction(action)
  -> GameActionQueueService.queueActionAndTryStartProcessor(action)
  -> atomic Redis Lua operation
```

The accepted-action observation must occur only after the atomic queue method
resolves successfully.

### 11.2 Accepted-action contract

Introduce test-only contracts equivalent to:

```ts
interface AcceptedActionRecord {
  readonly sequence: number;
  readonly gameId: string;
  readonly actionId: string;
  readonly actionType: GameActionType;
  readonly playerId: number;
  readonly socketId: string;
  readonly acceptedAt: Date;
}

interface AcceptedActionFilter {
  readonly gameId: string;
  readonly actionType?: GameActionType;
  readonly playerId?: number;
  readonly socketId?: string;
}

interface AcceptedActionProbe {
  waitForCount(expectedCount: number, timeoutMs?: number): Promise<void>;
  records(): readonly AcceptedActionRecord[];
  dispose(): void;
}
```

Exact symbol/file placement may follow the nearby scenario conventions, but do
not weaken these semantics.

Probe rules:

- Register before client emission.
- Record only successful atomic enqueues.
- Filter by game/action/player/socket.
- Keep recording after `waitForCount()` resolves so the caller can assert exact
  cardinality after drain.
- Return defensive record snapshots.
- Remove listeners idempotently on `dispose()`.
- Include recent accepted records in timeout diagnostics.
- `GameScenario` must track probes it creates and dispose them automatically.

### 11.3 Correct the monkeypatch point

Replace the dead/irrelevant `pushAction` instrumentation with instrumentation
around `queueActionAndTryStartProcessor`:

```text
increment in-flight counter
  -> await original atomic queue method
  -> emit accepted-action record
  -> return original result unchanged
finally
  -> decrement in-flight counter
  -> emit lifecycle progress signal
```

If the original method rejects:

- Do not emit an accepted-action record.
- Preserve and rethrow the original error.
- Still decrement the in-flight counter and notify lifecycle waiters.

Retain executor instrumentation only where it provides drain-progress signals;
do not use entry into `submitAction` as acceptance.

### 11.4 Track in-flight enqueues

Maintain a test-only static per-game in-flight enqueue count:

- Increment immediately before invoking the original atomic method.
- Decrement in `finally`.
- Remove zero entries.
- Notify lifecycle condition waiters whenever the value changes.

`waitForActionsComplete()` is true only when:

```text
inFlightEnqueues(gameId) === 0
AND queueLength(gameId) === 0
AND lockService.isLocked(gameId) === false
```

Its timeout diagnostic must include all three values plus the current peeked
action when available.

### 11.5 Compatibility behavior

Keep the existing `waitForSubmittedActions()` public test-helper method because
many older tests call it. Change its internal meaning to accepted enqueue:

- Use a scoped accepted-action probe.
- Preserve its current game/action/count filters and timeout defaults.
- Always dispose the probe in `finally`.
- Update its timeout message to say accepted/enqueued, not merely submitted.

New scenario code should use accepted-action terminology and the longer-lived
probe so it can assert exact counts and actor identity after drain.

### 11.6 Required tests for this phase

Create
`server/tests/socket/game/utils/SocketGameTestEventUtils.test.ts` with controlled
queue/lock dependencies. Cover:

- Probe does not resolve while the atomic enqueue promise is pending.
- Successful atomic enqueue produces one complete record.
- Rejected enqueue produces no accepted record.
- Wrong player/socket cannot satisfy a filtered probe.
- `waitForCount(15)` does not dispose history; exact records remain readable.
- Probe disposal removes listeners and is idempotent.
- Drain remains incomplete while one enqueue is in flight even if the queue is
  empty and lock is free.
- Drain completes only after in-flight count, queue, and lock all clear.
- Timeout diagnostics expose in-flight, queue, lock, and peek data.
- Legacy `waitForSubmittedActions()` now observes acceptance and cleans up its
  listener on success and error.

Checkpoint: run the new action-helper unit suite plus the existing contract
suite before changing Media scenarios.

## 12. Phase 4: EventJournal and GameScenario lifecycle hardening

### 12.1 Restrict predicates to synchronous logic

Change `EventPredicate` from `boolean | Promise<boolean>` to `boolean`.

No current scenario needs asynchronous payload predicates. Synchronous
predicates ensure record-order resolution and remove the async pre-scan/timer
registration race that previously broke the fake-timer timeout test.

Consequent implementation rules:

- `matches()` and `findMatchingRecord()` become synchronous.
- `notifyWaiters()` evaluates records synchronously in sequence order.
- Iterate over snapshots of wait maps because resolving/rejecting removes
  entries.
- If a predicate throws, reject only that expectation with the original error
  plus expectation/journal context.
- `expectEvent()` performs one synchronous existing-record scan and otherwise
  registers the wait immediately. No second async scan is needed because no
  event can interleave inside the same JavaScript turn.

### 12.2 Define disposal behavior

Add an idempotent `EventJournal.dispose(): Promise<void>`.

Required behavior:

1. Mark the journal disposed.
2. Detach all Socket.IO `onAny` listeners.
3. Copy every pending positive and negative wait.
4. Clear every pending timeout.
5. Remove all pending wait-map entries.
6. Reject each wait with an `EventJournalDisposedError` or equivalent diagnostic
   error containing event, actor, direction, description, sequence mark, and
   recent records.
7. Internally `Promise.allSettled()` the cancelled wait promises so cancellation
   cannot surface as unhandled rejection after cleanup.
8. Resolve disposal normally for expected cancellation. Only actual detach or
   disposal infrastructure failures should make `dispose()` reject.

To support safe settlement, store each deferred promise with its resolve/reject
callbacks in the pending wait record. A small local deferred helper is
acceptable.

A pending negative assertion must reject on disposal. It must never resolve as
"no event" after observation has stopped.

After disposal, these operations throw immediately:

- `attach`
- `recordOutgoing`
- internal inbound recording
- `mark`
- `expectEvent`
- `expectNoEvent`

Read-only snapshots may either remain available for diagnostics or throw;
prefer retaining snapshots because they are useful in cleanup error reports.

### 12.3 Prevent actor-label ambiguity

- `GameScenario.addActor()` throws before mutating state when a label already
  exists.
- `EventJournal.attach()` defensively throws when that label is already
  attached.
- Do not silently detach/replace an actor.
- Do not add reconnect replacement behavior in this task. Reconnect will need
  an explicit connection-generation identity when its scenarios are migrated.

### 12.4 Dispose the complete scenario

Make `GameScenario.dispose(): Promise<void>`:

1. Dispose every tracked accepted-action probe.
2. Await journal disposal.
3. Clear actor/probe registries.
4. Remain safe when invoked repeatedly.

Update every caller to await it.

### 12.5 Exact event-history API

Add a synchronous filtered-record query to `ScenarioAssertions`, supporting:

- actor (optional);
- direction;
- event;
- `afterSequence`;
- synchronous payload predicate.

It returns a defensive, sequence-ordered snapshot. Use it for exact counts and
payload-order checks only after action acceptance and queue drain establish
quiescence. Do not make the snapshot method poll or sleep.

Retain the existing positive/negative bounded waits for establishing event
arrival/absence. Improve exact-count failure diagnostics to include the
expected count and matching/recent records.

### 12.6 Required journal tests

Expand `EventJournal.test.ts` to cover:

- Previously recorded inbound event satisfies a later expectation.
- Event arriving after registration resolves the live waiter.
- Wrong actor does not satisfy a wait.
- Wrong payload does not satisfy a wait; a later correct payload does.
- Outbound burst records exact order and payloads.
- A negative assertion rejects for an already-recorded event.
- A negative assertion rejects when the event arrives during its window.
- A negative assertion resolves after a clean bounded window.
- Multiple concurrent positive and negative waits do not interfere.
- Predicate exception rejects with useful context.
- Timeout diagnostic includes duration, event, actor, direction, description,
  mark, and recent records.
- Disposal clears timers and rejects pending positive/negative waits.
- Disposal produces no unhandled rejection.
- Calls after disposal fail immediately.
- Duplicate actor label fails.
- Detach prevents later inbound recording.

For timeout tests, use `jest.useFakeTimers()`, start the expectation, flush the
microtask needed for registration if still applicable, and use
`advanceTimersByTimeAsync` / `runAllTimersAsync`. Restore real timers in
`afterEach` even if the assertion fails.

Checkpoint: run EventJournal and action-helper unit suites together with
`--detectOpenHandles`.

## 13. Phase 5: Media Download flow lifecycle and assertion API

### 13.1 Guard harness lifecycle

In `MediaDownloadScenario.test.ts`:

```ts
let harness: ServerTestHarness | undefined;
```

- Assign only after `ServerTestHarness.start()` resolves.
- `afterAll` calls `stop()` only when harness exists.
- A helper that needs the harness throws
  `ServerTestHarness was not started` when absent.
- Do not replace the original startup error with a teardown TypeError.

### 13.2 Replace repeated raw try/finally

Add a local or exported helper named `withMediaDownloadFlow` following nearby
style. It must:

1. Start the flow.
2. Execute the scenario callback.
3. Always dispose the scenario and clean up clients.
4. Rethrow the scenario failure when cleanup succeeds.
5. Throw cleanup failure when the scenario succeeded.
6. Throw one `AggregateError` with scenario error first when both fail.

Cleanup order:

```text
dispose scenario journal/probes
  -> strict client cleanup
  -> aggregate any failures
```

This prevents pending scenario expectations from observing disconnect traffic.

### 13.3 Flow construction options

Use a named options object instead of a bare player-count argument:

```ts
interface CreateMediaDownloadFlowOptions {
  readonly playerCount?: number;    // default: 2
  readonly spectatorCount?: number; // default: 0
}
```

Add an `allRecipients` getter in stable order:

```text
showman, all players, all spectators
```

### 13.4 Flow assertion capabilities

MediaDownloadFlow should provide domain-specific helpers for:

- Taking the underlying event mark.
- Creating an accepted `MEDIA_DOWNLOADED` probe optionally filtered to an actor.
- Asserting exact outbound command count after a mark.
- Asserting exact accepted-action count and actor identity from a probe.
- Retrieving exact Media status history for an actor after a mark.
- Waiting for one Media status using stable identity/readiness matching.
- Waiting for a matching broadcast to a recipient list.
- Asserting complete status payloads.
- Asserting player `mediaDownloaded` flags.
- Asserting question state.
- Asserting active persisted timer duration.
- Expiring the media timer through `TestUtils`.
- Strict cleanup.

Do not add a `doEverythingAndAssert()` helper. Each scenario must continue to
show its causal business steps.

Use an expectation shape equivalent to:

```ts
interface ExpectedMediaDownloadStatus {
  readonly playerId: number;
  readonly mediaDownloaded: true;
  readonly allPlayersReady: boolean;
  readonly timer:
    | { readonly kind: "none" }
    | { readonly kind: "active"; readonly durationMs: number };
}
```

When waiting for a status, use identity/readiness as the match predicate, then
assert the entire payload separately. A wrong timer must produce a direct Jest
assertion mismatch rather than a generic event timeout.

### 13.5 Deterministic timer assertions

Use production constants rather than copied numbers:

- `MEDIA_DOWNLOAD_TIMEOUT` for the initial download timer.
- `GAME_QUESTION_ANSWER_TIME` for the timer after transition to `SHOWING`.

Delete `expectNoMediaTimeoutBroadcast()`. A 100 ms absence window cannot prove
replacement of a 10-second timer.

Prove replacement by asserting:

- initial persisted state has the Media Download duration;
- partial status has `timer: null` and the Media timer remains active;
- full readiness/timeout status carries the Showing timer;
- final persisted state has the Showing duration.

## 14. Phase 6: final golden Media Download scenarios

Rename the suite from POC wording to a Media Download client-contract/golden
suite after all cases below pass.

### Scenario A: one player completes immediately

Setup:

- 1 player, 0 spectators.
- Pick a regular Media Download question.
- Assert `MEDIA_DOWNLOADING` and `MEDIA_DOWNLOAD_TIMEOUT` before the command.

Act:

- Take mark.
- Arm actor-scoped accepted-action probe and status waits.
- Emit one `MEDIA_DOWNLOADED` from the player.
- Await accepted action and status together.
- Drain.

Assert:

- Exactly 1 outbound command.
- Exactly 1 accepted action with the player's ID/socket.
- Exactly 1 relevant status per recipient.
- Status fields: player ID, `mediaDownloaded: true`,
  `allPlayersReady: true`, active `GAME_QUESTION_ANSWER_TIME` timer.
- Player readiness is true.
- State is `SHOWING`.
- Persisted timer has `GAME_QUESTION_ANSWER_TIME`.
- No socket error after the mark.

### Scenario B: partial readiness waits

Setup:

- 2 players.
- Pick and assert initial Media state/timer.

Act:

- Mark and arm a probe for player 1 plus false-status wait.
- Emit player 1 once.
- Await acceptance/status together, then drain.

Assert:

- Exactly 1 outbound and 1 accepted player-1 action.
- Complete status: player 1, `mediaDownloaded: true`,
  `allPlayersReady: false`, `timer: null`.
- Player 1 readiness true; player 2 false.
- State remains `MEDIA_DOWNLOADING`.
- Persisted timer still has `MEDIA_DOWNLOAD_TIMEOUT`.
- No socket error.

### Scenario C: concurrent two-player completion is order-agnostic

Setup:

- 2 players, 1 spectator.
- Pick and assert initial Media state/timer.

Act:

- Take mark.
- Arm one total-game accepted-action probe and final true broadcast waits for
  `allRecipients`.
- Synchronously call emit for both player sockets without awaiting either.
- Await 2 accepted actions and final true broadcasts, then drain.

Assert:

- Exactly 2 outbound commands.
- Exactly 2 accepted actions.
- Accepted player-ID/socket set equals both players, regardless of order.
- Every showman/player/spectator receives exactly 2 Media statuses after mark.
- Per recipient:
  - status player-ID set equals both players;
  - first processed status is false with `timer: null`;
  - second processed status is true with active Showing timer;
  - both statuses have `mediaDownloaded: true`.
- Do not assert that player 0 is first or player 1 is final.
- Both readiness flags true.
- State `SHOWING` and persisted Showing timer.
- No socket error.

### Scenario D: 15 duplicates settle before the remaining player

Setup:

- 2 players.
- Pick and assert initial Media state/timer.

Duplicate phase:

- Take duplicate mark.
- Arm a `MEDIA_DOWNLOADED` probe filtered to player 1 ID/socket.
- Emit exactly 15 commands synchronously through `ScenarioActor.emitMany()`.
- Wait for 15 accepted actions, then drain.

Assert duplicate phase:

- Exactly 15 outbound player-1 commands.
- Exactly 15 accepted player-1 actions with distinct action IDs.
- Showman sees exactly 15 player-1 status broadcasts after the mark.
- Every status has `mediaDownloaded: true`, `allPlayersReady: false`, and
  `timer: null`.
- No true readiness status and no system timeout status exists after the mark.
- Player 1 readiness true; player 2 false.
- State remains `MEDIA_DOWNLOADING`; Media timer remains active.

Completion phase:

- Take a new mark after the duplicate phase drain.
- Arm a new probe filtered to player 2 and final broadcast waits.
- Emit player 2 once.
- Await acceptance/final broadcasts, then drain.

Assert completion phase:

- Exactly 1 outbound and 1 accepted player-2 action after the second mark.
- Exactly 1 final true status per recipient.
- No late player-1 duplicate status exists after the second mark.
- Both readiness flags true.
- State `SHOWING` and persisted Showing timer.
- No socket error.

The exact 15 repeated status broadcasts deliberately codify current production
behavior. Do not add production deduplication in this PR.

### Scenario E: partial readiness followed by deterministic timer expiry

Setup:

- 2 players, 1 spectator.
- Pick and assert initial Media state/timer.
- Settle one player's partial-readiness command exactly as in Scenario B.

Act:

- Take a fresh mark after the partial action drains.
- Arm system timeout-status broadcasts for every recipient.
- Call `expireMediaDownloadTimer()` / `expireTimerAndWaitForAction()`.
- The timer action wait must use the new accepted-enqueue semantics.
- Await timeout broadcasts and drain.

Assert:

- Exactly 1 system Media status per showman/player/spectator after the mark.
- Status: `SYSTEM_PLAYER_ID`, `mediaDownloaded: true`,
  `allPlayersReady: true`, active `GAME_QUESTION_ANSWER_TIME` timer.
- Both readiness flags true.
- State `SHOWING` and persisted Showing timer.
- No socket error.

## 15. Phase 7: prove parity and remove legacy duplication

Do not delete `server/tests/socket/game/MediaDownloadFlow.test.ts` first.

After the new scenarios pass, map legacy coverage as follows:

| Legacy behavior | Replacement/source |
|---|---|
| Single-player transition | Golden Scenario A |
| Partial multi-player readiness | Golden Scenario B |
| Out-of-order/multi-player readiness | Golden Scenario C |
| Whole-game/spectator delivery | Golden Scenarios C and E |
| Duplicate Media events | Golden Scenario D |
| Partial readiness then timeout | Golden Scenario E |
| Media vs Showing timer semantics | Golden Scenarios A, B, C, E |
| FIFO/queue mechanics | Existing `GameLockAndQueueMechanics.test.ts` |

Then remove the legacy Media Download E2E suite rather than keeping two suites
that exercise the same transport flow.

Do not delete or weaken `GameLockAndQueueMechanics.test.ts`.

Explicitly record these deferred gaps in the final handoff rather than keeping
weak legacy tests:

- spectator emits `MEDIA_DOWNLOADED`;
- player emits before `MEDIA_DOWNLOADING`;
- player emits after `SHOWING`;
- unauthenticated/wrong-role action behavior.

Those cases are not part of this stabilization slice.

## 16. Phase 8: CI and documentation alignment

### 16.1 GitHub Actions environment variables

In `.github/workflows/test.yml`, make the server test job explicit:

```text
TEST_REDIS_HOST=127.0.0.1
TEST_REDIS_PORT=6379
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
```

- Remove unused/misleading `REDIS_URL`, `DB_USERNAME`, `DB_PASSWORD`, and
  `DB_DATABASE`.
- Leave `DB_NAME` unset so per-worker `test_db_N` naming remains active.
- Keep `NODE_ENV=test` and session configuration.

Do not change `server/scripts/test/runPipelineTests.mjs`. The verified baseline
proved it forwards arguments, preserves Jest's exit status, and keeps useful
failure output.

### 16.2 Canonical E2E guidance

Update `server/tests/e2e/README.md` with concise permanent rules learned from
the implementation:

- Accepted action means successful atomic queue enqueue.
- Required scenario sequence: mark, arm, emit, await, drain, exact assertions.
- Predicate functions are synchronous.
- Exact snapshots are valid only after drain.
- Scenarios and action probes must be awaited/disposed.
- Duplicate actor labels are rejected.
- Cleanup failures propagate.
- Static `SocketActionContracts.test.ts` is a wiring guard, not a substitute for
  transport E2E.
- Local test Redis defaults to `127.0.0.1:6380` through Compose.
- PostgreSQL/Redis infrastructure requirements and focused commands.

Update `server/AGENTS.md` testing rules to link the E2E README.

Update `.agents/skills/project-assurance/SKILL.md` to direct scenario/journal
work to the E2E README. Keep the skill short; do not copy the entire README into
it.

Do not update `docs/agent/03-verification-matrix.md`: command names and public
verification categories are unchanged.

When commit/push/PR mutation is explicitly authorized and the exact new head is
green, refresh the PR body verification section. Do not mark the draft PR ready
automatically.

## 17. Phase 9: verification sequence

Run commands from `server/` unless stated otherwise. Report every command and
whether it passed, failed, or was not run.

### 17.1 Fast static/unit checks

```text
npx jest tests/utils/TestEnvironmentSafety.test.ts \
  --runInBand --detectOpenHandles

npx jest tests/socket/game/utils/SocketGameTestEventUtils.test.ts \
  --runInBand --detectOpenHandles

npx jest tests/e2e/scenario/EventJournal.test.ts \
  tests/e2e/contracts/SocketActionContracts.test.ts \
  --runInBand --detectOpenHandles
```

### 17.2 Focused infrastructure checks

Requires PostgreSQL and Redis:

```text
npx jest tests/e2e/flows/MediaDownloadScenario.test.ts \
  --runInBand --detectOpenHandles

npx jest tests/socket/game/GameLockAndQueueMechanics.test.ts \
  --runInBand --detectOpenHandles
```

If the full queue-mechanics file is prohibitively slow during iteration, run
its Media-related tests first, but run the complete file before handoff.

### 17.3 Flake check

Run `MediaDownloadScenario.test.ts` 10 consecutive times with the same command,
stopping on the first failure. Do not create a committed repetition script
solely for this check.

If any repetition fails:

- Preserve the first failure diagnostics.
- Reproduce the failing test alone.
- Diagnose ordering, pending wait, queue/in-flight, cleanup, or timer cause.
- Do not raise timeouts as the fix.

### 17.4 Full server checks

```text
npm run lint
npm run build
npm run test:pipeline
```

From repository root:

```text
git diff --check main...HEAD
git status --short
```

No client/OpenAPI validation is required because those areas must remain
unchanged. If they changed unexpectedly, treat that as scope drift.

### 17.5 Exact-head CI

Only when publishing is authorized:

- Commit using a concise result-oriented message.
- Push the current branch.
- Verify GitHub Actions for the exact pushed SHA.
- Do not report the previous `a2488efde` run as verification of new changes.

## 18. Rules for the executing model

### Editing and scope rules

- Use `apply_patch` for hand edits.
- Preserve user changes and unrelated files.
- Do not run broad formatters over the repository.
- Do not add dependencies or generated files.
- Do not change production behavior to satisfy a test without explicit user
  approval.
- Keep new instrumentation under `server/tests/`.
- Do not edit client, OpenAPI, Buzzer, reconnect, or final-round code.

### Test-quality rules

- A wait named "submitted" must not resolve before atomic enqueue success.
- A drain check must include in-flight enqueues, queue length, and lock state.
- An event assertion must include actor/direction/event/mark and payload identity
  when ambiguity exists.
- Exact counts happen only after quiescence.
- Negative assertions must be bounded and must explain the window they prove.
- Do not use a short negative window to claim a long timer was cancelled.
- Do not silently catch setup, cleanup, predicate, or expectation errors.
- Do not treat a static action-map test as E2E transport coverage.

### Collaboration and stop rules

- Give concise progress updates during long work.
- If stricter cleanup reveals a defect inside the touched helpers or Media flow,
  fix the root cause and add a regression test.
- If it reveals a materially unrelated subsystem failure, reproduce it and ask
  before expanding scope.
- If current production behavior contradicts the documented Media contract,
  report the exact code/test evidence. Do not simply rewrite expectations to
  whatever happens today and do not silently change production.
- If safe test execution would require a non-loopback Redis, stop. Do not weaken
  the destructive-cleanup guard.
- Do not create commits, push, rewrite history, or update PR metadata unless the
  user explicitly authorizes those operations.

## 19. Definition of done

All conditions must be true:

- [ ] Ordinary `.env` and production `REDIS_*` cannot redirect tests.
- [ ] Unsafe Redis targets fail before key enumeration or deletion.
- [ ] Residual Redis keys fail the responsible test with diagnostics.
- [ ] Socket cleanup always closes clients and propagates all failures.
- [ ] Accepted-action waits resolve only after atomic enqueue success.
- [ ] Queue drain cannot resolve while an enqueue is in flight.
- [ ] Action probes support exact actor-aware counts and clean disposal.
- [ ] Event predicates are synchronous and deterministic.
- [ ] Scenario disposal leaves no listeners, timers, probes, or unhandled
      rejections.
- [ ] Duplicate actor labels fail immediately.
- [ ] Harness startup failure is not obscured by teardown.
- [ ] Concurrent player completion makes no fixed actor-order assumption.
- [ ] Complete Media status payloads and spectator delivery are asserted.
- [ ] Duplicate burst proves 15 outbound, accepted, and processed status events
      before the remaining player acts.
- [ ] Timer behavior is proven with deterministic expiry and duration checks.
- [ ] Legacy duplicate Media E2E suite is removed after parity.
- [ ] E2E README, server guidance, skill routing, and CI variables are current.
- [ ] New focused unit tests pass.
- [ ] Media and queue-focused integration tests pass.
- [ ] Media golden suite passes 10 consecutive runs.
- [ ] `npm run lint`, `npm run build`, and `npm run test:pipeline` pass.
- [ ] `git diff --check main...HEAD` passes.
- [ ] No client/OpenAPI/production gameplay changes were introduced.
- [ ] Buzzer/Answer migration was not started.

## 20. Required final handoff

The implementing model's final report must include:

- Work category (`bug_fix` and `refactor_only`).
- Exact behavioral defects fixed.
- Test-only interfaces/helpers added or changed.
- Redis safety behavior and local/CI configuration.
- Cleanup propagation behavior.
- Media scenarios retained and legacy coverage removed.
- Deferred invalid-action gaps.
- Documentation/skill/CI files updated.
- Every verification command with pass/fail/not-run status.
- Repetition count and result for the Media flake check.
- Exact pushed SHA and CI result only if publishing was authorized.
- Any remaining risks or deviations from this plan, with reasons.

After completion and review, remove or archive this temporary execution plan so
future agents use the permanent E2E README and project-assurance skill instead.

---
name: backend-smoke-tests
description: Use for OpenQuester backend feature work and behavior fixes when deciding, adding, or running focused smoke coverage. Requires one minimal backend E2E regression or happy-path test for new observable behavior, avoids smoke-test churn for minor behavior-neutral changes, and follows the concise backend test runner workflow.
---

# Backend smoke tests

Add smoke coverage only where it proves a new backend capability or a fixed user-visible regression. Keep the smoke layer small, behavior-oriented, and based on the existing backend E2E infrastructure.

## Read first

1. Read `server/AGENTS.md`.
2. Read `.agents/skills/backend-test-runner/SKILL.md` and obey its output and `--forceExit` rules.
3. Read `server/tests/e2e/README.md` before adding or changing smoke coverage.
4. Inspect the nearest existing E2E suite and helpers before creating a new file or abstraction.

## Decide whether smoke coverage is required

Add or update one focused backend smoke test when the change introduces:

- a new backend feature with observable HTTP, Socket.IO, lifecycle, persistence, or runtime behavior; or
- a behavior fix whose regression can be observed through a backend boundary.

Do not add a smoke test merely because a file changed. Skip new smoke coverage for documentation, formatting, renames, behavior-preserving refactors, test-only cleanup, and other minor changes that do not add or fix observable backend behavior.

If an existing E2E case already exercises the path, add the smallest regression case or assertion there instead of creating a duplicate suite. If the behavior cannot meaningfully be exercised through a backend boundary, do not fabricate an E2E test: add the nearest meaningful unit or integration regression test and explain why smoke coverage is not applicable.

## Write the test

- Prove one critical path: the feature starts and produces its primary observable result, or the reported regression no longer occurs.
- For a fix, make the test fail against the broken behavior and pass with the fix whenever practical.
- Use `ServerTestHarness` and real HTTP or Socket.IO transports for new transport E2E coverage.
- For client-perspective game flows, use `GameScenario`, actors, `ScenarioAssertions`, and `EventJournal` according to `server/tests/e2e/README.md`.
- Follow the existing accepted-action, wait, drain, assertion, disposal, and cleanup sequence exactly.
- Reuse the nearest fixture or helper. Extract a new flow helper only after the pattern repeats.
- Keep waits named, bounded, and deterministic. Never add sleeps or inflate timeouts to make the smoke test pass.
- Keep exhaustive branches, validation matrices, and edge cases in focused unit/integration coverage rather than multiplying smoke scenarios.

## Run with minimum logs first

Run only the new or changed smoke case through the concise pipeline command from `server/`:

```bash
npm run test:pipeline -- tests/e2e/path/FeatureSmoke.test.ts -t "exact smoke test name" --runInBand
```

Use this minimal-output result and exit code for normal verification. Do not run a broad smoke suite or the full backend suite solely because one smoke case changed unless the change risk independently requires it.

## Request detailed logs only for a reason

Use detailed output only when the concise run fails and does not provide enough information to diagnose the specific case, for example an unexplained timeout, cleanup failure, or missing event.

Run the same single test case directly and include `--forceExit`:

```bash
npx jest tests/e2e/path/FeatureSmoke.test.ts -t "exact smoke test name" --runInBand --forceExit
```

Do not enable detailed output preemptively. Do not include another test file or test name. After diagnosis or a fix, rerun the exact case through `npm run test:pipeline -- ...` and use that concise result as final verification.

## Report

State:

- why smoke coverage was required or intentionally skipped;
- the backend behavior proved by the test;
- the exact minimal-output command and result;
- the concrete reason detailed logs were needed, if used;
- the final concise rerun result;
- any unavailable PostgreSQL or Redis dependency.

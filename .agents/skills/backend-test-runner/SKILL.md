---
name: backend-test-runner
description: Use when running, debugging, or reporting OpenQuester backend Jest tests. Enforces concise test:pipeline output for normal verification, permits detailed logs only for one isolated test, and requires --forceExit for every direct test command outside npm scripts.
---

# Backend test runner

Use this skill whenever backend tests are executed, whether as the main task or as verification for a code change. Keep routine output concise so unrelated test logs do not consume context.

## Read first

1. Read `server/AGENTS.md` for backend-wide rules and infrastructure requirements.
2. Read `docs/agent/03-verification-matrix.md` to select the relevant checks.
3. Read the nearest test-area guide, such as `server/tests/e2e/README.md`, when it exists.
4. Run all commands from `server/`.

## Mandatory command policy

- Use `npm run test:pipeline` for a full backend test run and for the normal pass/fail verification of test changes.
- Pass Jest selectors through the pipeline runner when narrowing routine verification:

  ```bash
  npm run test:pipeline -- path/to/test.ts --runInBand
  npm run test:pipeline -- path/to/test.ts -t "exact test name" --runInBand
  ```

- Treat pipeline output and its exit code as the source of truth for normal verification. The runner suppresses ordinary test stdout and exposes the result without flooding the agent context with logs.
- The pipeline fails when Jest detects an open handle. Do not pass
  `--forceExit`, `--no-detectOpenHandles`, or another argument that disables
  this check; the runner rejects those options.
- The runner also refuses a concurrent pipeline in the same checkout so two
  processes cannot share and destructively reset the same test databases.
- Do not use `npm test`, raw `jest`, `npx jest`, or a direct Node invocation of Jest for full-suite or multi-test verification.
- Do not rerun a passing pipeline suite manually merely to obtain verbose output.

## Detailed-log exception

Use detailed Jest output only when the concise pipeline result is insufficient to diagnose a failure.

1. Isolate exactly one test case by combining one test file with `-t "exact test name"`.
2. If the file contains only one test case, selecting that one file is sufficient.
3. Run no other test files or test cases in the detailed-log command.
4. Because this is a direct command outside `npm run`, always include `--forceExit`:

   ```bash
   npx jest path/to/test.ts -t "exact test name" --runInBand --forceExit
   ```

5. Return to `npm run test:pipeline -- ...` after diagnosis to verify the final result concisely.

Never request detailed logs for an entire suite, directory, wildcard, or collection of test names. Narrow the failure first using the pipeline result, then inspect only the single failing test.

## Force-exit invariant

Every manual test invocation that does not go through an npm script must include `--forceExit`. This includes `npx jest`, `node node_modules/jest/bin/jest.js`, and equivalent direct Jest commands. Do not omit the flag even when the process appears likely to exit normally.

Do not add `--forceExit` to unrelated npm scripts or edit `package.json` merely to satisfy this rule; the invariant applies at the manual command boundary.

## Reporting

Report:

- the exact pipeline command used;
- pass/fail and the exit result;
- any infrastructure blocker, especially unavailable PostgreSQL or Redis;
- the exact single-test diagnostic command, if detailed logs were necessary;
- checks not run and why.

Summarize the relevant failure instead of copying unrelated Jest output into the handoff.

---
name: code-quality-review
description: Review OpenQuester changes for readability, maintainability, and recurring code quality mistakes, especially in the backend, and fix them when requested. Use for code reviews, clean-code cleanup, or addressing review feedback; not as an automatic whole-repository audit during ordinary feature work.
---

# Code Quality Review

Find code that is difficult to understand or safely change, explain the concrete
cost, and make the smallest readable correction within the user's scope.

## Scope and mode

- Review, audit, or assess means inspect and report. Edit when the user asks to
  fix, resolve, clean up, or implement the feedback, including authorization
  already given in the conversation. Do not ask again for authorized local fixes.
- Use the specified PR, diff, commit range, or paths. Otherwise inspect the local
  working diff, including staged and relevant untracked files, and state that
  scope. With no change or target to review, ask for the target instead of silently
  starting a repository-wide audit.
- For PRs/branches, verify the actual base and head and review their merge-base diff;
  do not substitute the last commit or an assumed `main`. State coverage limits.
- Read surrounding code, callers, tests, and existing helpers to understand the
  flow. A PR/diff review reports issues introduced or worsened by that change;
  distinguish pre-existing concerns. Inspect similar changed code beyond existing
  comments, but do not expand a targeted fix into unrelated cleanup.
- Preserve pre-existing work. Creating this skill or running a review does not
  authorize commits, posting review comments, pushing, or merging.

## Read the owning guidance

Repository paths below are relative to the repository root.

1. Read root `AGENTS.md` and the nearest scoped `AGENTS.md` for the reviewed paths.
2. Read the relevant spec/ADR only when the code touches that behavior or boundary.
   Use `docs/agent/02-source-of-truth.md` to resolve ownership or conflicting docs.
3. For fixes, load the affected workflow from `.agents/skills/README.md`:
   `backend-maintenance` for backend cleanup/refactoring; HTTP, socket, rules,
   Redis, runtime, contract, or frontend guidance when those areas actually change.
   This skill selects and explains issues; those workflows govern implementation.

## Quality criteria and examples

Apply these criteria with judgment. The goal is code a person can understand and
safely change, not fewer lines or more abstractions. Examples are illustrative;
check actual contracts and callers before applying them.

### Name the domain, inputs, and result

Names of files, classes, methods, arguments, variables, and return types should
explain what they represent or do. Distinguish requested from applied values,
IDs from objects, counts from collections, and milliseconds from days. Keep domain
and protocol vocabulary consistent. Generic names such as `data`, `result`,
`missing`, or `handle` need enough local context to make their meaning clear.

```ts
// Opaque: the reader must inspect the helper to learn what is missing.
const missing = await findMissing(packageId);

// Clear only if the helper actually returns filenames, not IDs or objects.
const missingMediaFilenames = await findMissingMediaFilenames(packageId);
```

### Expose conditions and stages

Use named intermediate values when they reveal a business rule; do not name every
subexpression. Separate distinct stages with blank lines. Use braces for backend
branches and loops, including early returns. Prefer clear termination conditions;
an unbounded loop needs a reason and a progress guarantee, not a blanket rewrite.
Preserve truth conditions when extracting predicates, especially for zero, empty
strings, null, and undefined. Avoid dense one-liners or nested expressions whose
only advantage is fewer lines.

### Decompose around responsibilities

Separate validation, calculations, decisions, and side effects when this reveals
the business sequence. Extract a helper when it names a cohesive responsibility
or shares the same rule across callers. Keep short local calculations inline when
extraction only adds navigation. Similar syntax with different reasons to change
does not necessarily belong in one helper.

```ts
validateChoiceSelection(question, selectedChoices);
const answerResult = evaluateSelectedChoices(question, selectedChoices);
applyAnswerResult(game, answerResult);
```

Avoid speculative frameworks, unrelated generic utilities, and chains of tiny
pass-through methods. Required ports, safety wrappers, and adapters can still be
useful with one implementation. Do not move work across authorization, transaction,
or queue boundaries to make a method shorter.

### Explain what names cannot

Use brief adjacent comments for non-obvious rules, invariants, units, compatibility
constraints, and reasons for surprising operations. Prefer a better name over a
comment restating syntax; use a small input/output example when a shape remains
unclear. Mark the reason and boundary when legacy and current rules coexist.

For `tryTransition`, inspect the router and handlers and name the actual source
and destination phases, including every possible pair for a branching call:

```ts
// Transition from SHOWING to SHOWING_ANSWER after the timer expires.
const transitionResult = await phaseTransitionRouter.tryTransition(transition);
```

Use that comment only when the call really makes that transition. Update comments
with behavior; a generic "Try transition" comment supplies no missing context.

### Make types and module names accurate

Declare imports at the top of the file. Never use inline `import("module").Type`
annotations or `typeof import("module")` type queries. Import the symbol with
`import type` and refer to it by name. Keep ordinary runtime dependencies at the
top as static imports too. Use dynamic `import()` only when deferred loading or
loading in a separate runtime is required, such as a lazy browser chunk or a
Playwright page fixture.

Reuse domain types when they model the data correctly. Give meaningful shared
inputs/results named types instead of repeating inline shapes or hiding the
contract in nested type machinery. Keep required fields required when guaranteed;
do not use casts, non-null assertions, or optional fields to conceal a contract
problem. Validate untrusted input at its boundary. Small local types need not be
exported; a few clear positional arguments need not become an options object.

For an internal result with exclusive outcomes, encode the associated data when
that improves callers' understanding:

```ts
type MediaProbeResult =
  | { status: "ready"; sizeBytes: number }
  | { status: "missing" };
```

This avoids requiring callers to assert that an optional size exists after a ready
result. It is not a reason to redesign shared/public contracts during cleanup.
Follow scoped module conventions: backend class files use PascalCase, function-only
modules use camelCase, executable logic stays out of DTO modules, and public methods
precede private methods. Do not cosmetically rename public wire fields or events.

Name new TypeORM migrations `<version>_<Action>_<timestamp>.ts` and their classes
`<Action>_<version_with_underscores>_<timestamp>`. Use a unique current Unix
timestamp in milliseconds, greater than every existing migration timestamp.
Register migrations in ascending timestamp order in `DataSource.ts` and keep
released migration names and timestamps stable.

### Distinguish absence from valid values

Trace producers and consumers before replacing defaults. `value || fallback`
also replaces zero and empty strings. `value ?? fallback` replaces both null and
undefined, which is correct only when both mean "use the default". If null means
unlimited, retain that distinction:

```ts
const effectiveByteLimit =
  requestedByteLimit === undefined ? defaultByteLimit : requestedByteLimit;
const exceedsByteLimit =
  effectiveByteLimit === null ? false : totalBytes > effectiveByteLimit;
```

Reject null at the boundary if the contract forbids it rather than silently making
it a default. An empty successful result is also distinct from an I/O failure.

### Reuse behavior and minimize external work

Inspect helper implementations: differently named calls may read the same Redis
key or database row. Fetch once and pass the result where its authorization,
freshness, transaction scope, and failure semantics allow it:

```ts
const gameEntity = await gameService.getGameEntity(gameId);
const gameListItem = gameMapper.toListItem(gameEntity);
```

Prefer supported batch operations to per-item DB/storage calls. Prefer ORM
operations when they express the query clearly; a focused raw query is appropriate
when it preserves required behavior or avoids round trips, with the reason beside
it. Reuse existing endpoints, configuration, actions, platform features, and
dependencies before adding proxies, runtime scripts, packages, or wrappers.

### Make failure and async ownership visible

Catch where code can recover, translate at an owning boundary, or observe an
otherwise unhandled failure. Use the existing typed errors and resolution path;
avoid catch/log/rethrow blocks at every layer. A fallback must implement a real
contract, not disguise an unexpected failure as success:

```ts
// An outage would look like a successful empty result.
const mediaFiles = await mediaRepository.listByPackageId(packageId).catch(() => []);
```

If empty success is not the failure contract, let the existing boundary handle it:

```ts
const mediaFiles = await mediaRepository.listByPackageId(packageId);
```

Removing a fallback is a behavior fix. Check intentional partial-result and
best-effort behavior first. An observer attached to a promise while callers retain
the original rejecting promise differs from returning a recovered promise.

Identify who owns completion, rejection, and cleanup for async work. `void` does
not handle rejection. Preserve error-forwarding wrappers and intentional observers.
Parallelize only independent work whose partial completion is acceptable;
`Promise.all` neither rolls back writes nor cancels remaining work after rejection.
Use existing batching or bounded concurrency for unbounded per-item I/O. Submission
to a queue may not mean completion: dependent work belongs in its serialized use
case or mutation flow, not an immediate follow-up or parallel promise.

### Keep mutation ownership explicit

A read or calculation should not silently change its inputs. Inspect aliases before
mutating shared entities or collections; keep legitimate mutations in their owning
domain/application flow. For an independently sorted view:

```ts
const rankedPlayers = [...players].sort((left, right) => right.score - left.score);
```

The copy changes array ownership only; player objects remain shared. Do not clone
everything or remove intentional in-place updates. Preserve ordering, tie behavior,
and reference semantics. Check retries, concurrency, role eligibility, timers, and
phase transitions before removing apparently redundant guards or filters.

### Keep tests short and direct

Assume developers rarely read tests end to end and mainly inspect them when they
fail. Prefer concise setup, direct assertions, and informative test names and
failure messages. Tests need less ceremony than production code: use minimal
fixtures and compact local names where their meaning is obvious. Avoid unnecessary
helpers, excessive comments, and elaborate setup for a small assertion. Use table
cases when they shorten genuinely repeated scenarios without hiding the rule.
Do not flag a compact test merely for lacking production-style decomposition.
Keep the assertions, synchronization, and cleanup needed to prove the behavior
reliably; shorter tests should retain useful coverage and failure diagnostics.

## Review with evidence

Trace inputs through decisions, state changes, side effects, and outputs before
proposing a simplification. Apply the criteria above to the actual reviewed flow.
For backend changes, explicitly check layer ownership and queue/mutation boundaries
against `server/AGENTS.md`; fewer lines do not justify bypassing them.

For each candidate concern:

- Locate the confusing or incorrect code and identify the actual caller, value,
  transition, or failure path that makes it matter. Search for existing helpers
  and inspect their behavior before proposing a new abstraction or duplicate read.
- Explain the consequence: a misleading contract, hidden ordering, repeated I/O,
  a missed error, or a business rule that a maintainer must reconstruct. A useful
  readability finding does not require a runtime bug, but needs a concrete example
  and a clearer alternative.
- Check counterevidence: an established domain name, enforced invariant, required
  adapter/DI port, intentional retry, or compatibility constraint may justify it.
  Report unknowns as unknowns; do not guess transition pairs or claim dead code
  from one search without checking registration and callers.
- Drop preferences with no demonstrated benefit. Do not impose function-length
  limits, ban loops or raw SQL, extract every repeated expression, remove required
  one-implementation ports, or rewrite syntax solely to look more "human".

Prioritize correctness/data/contract risks first, then concrete maintainability
issues and explicit project conventions. Keep optional style suggestions separate
and non-blocking. Group repeated instances with the same cause; do not manufacture
a quota of findings or inflate readability concerns into production failures.

## Resolve authorized issues

Choose a local rename, clearer condition, deletion, existing helper, or cohesive
extraction according to the actual problem. Preserve public shapes, truth
conditions (including zero/empty/null), errors, call order/count, mutation ownership,
authorization, freshness, and transaction/queue scope unless changing them is part
of the requested fix. A confirmed redundant read can be removed after checking
those semantics; preserving behavior is not a requirement to preserve waste.

Classify each edit as behavior-neutral cleanup or a behavior fix. For cleanup-only
requests, report unrelated bugs without silently changing their behavior. If a
requested fix needs an unresolved product decision, isolate that question and
continue independent authorized work. Keep related callers and comments consistent;
avoid reformatting or renaming unrelated modules.

Use `docs/agent/03-verification-matrix.md` for checks. Run appropriate static checks
for edited code and focused existing tests; add a regression for changed behavior
or a risky refactor, not tests of private names or formatting. Assert the rule that
could break: zero retains its meaning, failure stays distinguishable from empty
success, or a rejected action leaves state unchanged. Reuse existing harnesses and
synchronization boundaries rather than mirroring implementation details. Follow
`backend-smoke-tests` for observable backend fixes and `backend-test-runner` before
executing backend Jest. Update canonical docs when the fix changes documented
behavior or workflow. Re-read the final diff for accidental semantic changes.

## Handoff

For review-only work, lead with prioritized findings: exact file/line, concrete
consequence, relevant rule, and the smallest recommended correction. Separate
optional suggestions and unverified questions. If there are no actionable findings,
say so; include the reviewed scope and remaining verification limits.

After fixes, summarize resolved issues and any remaining concerns, distinguish
behavior changes from cleanup, and list checks run or skipped with reasons. Report
actual test evidence; passing lint or a lower-layer test is not proof of the full
user-visible flow. Honor the user's requested review format.

## Supporting rationale

The criteria align with [Google's review guidance](https://google.github.io/eng-practices/review/reviewer/looking-for.html)
and [TypeScript's discriminated-union guidance](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions).
These are optional background, not additional required reading or substitutes for
project rules. Historical review feedback informs the criteria; it is not evidence
that a defect still exists in the current tree.

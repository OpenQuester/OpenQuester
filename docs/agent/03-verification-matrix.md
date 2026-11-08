# Verification matrix

Use this matrix to choose checks for agent-created changes. Not every task needs every command, but every handoff summary should say what was run and what was not run.

## General rule

Run the narrowest reliable checks for the touched area. If a check needs unavailable infrastructure, say so and run the next best static/type/schema checks.

## Backend checks

Run from `server/`.

| Change type | Minimum checks | Stronger checks |
|---|---|---|
| Docs-only backend docs | Markdown review, link/path sanity | none required unless commands changed |
| TypeScript compile-sensitive change | `npm run lint`, `npm run build` | focused Jest test |
| REST endpoint/controller/scheme | `npm run lint`, `npm run build`, `npm run validate:schema` | focused REST tests, `npm run test:pipeline` |
| Socket event/action/use case | `npm run lint`, `npm run build`, `npm run validate:schema` if public contract changed | focused socket/game tests, queue-sensitive test |
| Game state/domain logic | `npm run lint`, `npm run build`, focused Jest tests through `test:pipeline` | `npm run test:pipeline` with PostgreSQL + Redis |
| Redis lock/queue/timer logic | `npm run lint`, `npm run build`, focused integration tests through `test:pipeline` | `npm run test:pipeline`, load/reconnect scenario when available |
| DB model/repository/migration | `npm run lint`, `npm run build` | migration/integration test against PostgreSQL |
| Logging/metrics/admin diagnostics | `npm run lint`, `npm run build` | focused endpoint/service tests |
| OpenAPI/schema only | `npm run validate:schema` | web `npm run gen:api` and `npm run check:api` |
| Backend E2E/helper/lifecycle/policy | changed infrastructure self-tests through `test:pipeline`, lint/build if TypeScript changed | relevant real transport cases; independent repeatability passes for broad reliability work |

Backend test rules:

- Read `.agents/skills/backend-test-runner/SKILL.md` before executing backend tests.
- For a new observable backend feature or behavior fix, use `.agents/skills/backend-smoke-tests/SKILL.md` to add and run one focused E2E smoke case. Do not add smoke tests for minor behavior-neutral changes.
- Use `npm run test:pipeline` for normal full-suite or focused pass/fail verification; do not use verbose/manual Jest for aggregate runs.
- If detailed logs are required, run exactly one isolated test. Every direct test command outside `npm run` must include `--forceExit`.
- Do not use `setTimeout` to wait for game timers in tests; use `TestUtils.expireTimer()`.
- Do not increase test timeouts to hide missing events.
- Tests requiring PostgreSQL/Redis must say so when not run.
- Follow `backend-e2e` and `server/tests/e2e/README.md` for transport writing and
  self-test → focused transport → full/repeatability sequencing. The README owns
  exact selectors and CI artifact instructions; do not maintain a failure allowlist.
- For negative command assertions, keep the pre-command mark but run the final
  historical + live-window check after the actual processing boundary. Test both
  a quiet flow and a forbidden event later than the initial 100ms window; disconnect
  must not count as silence. `GameScenario` owns complete assertion outcomes.
- Concurrency evidence requires emitting independent commands before awaiting
  their replies, acceptance of every command (including the last drain trigger),
  and exact result IDs/counts. Controlled FIFO scenarios also assert enqueue order.
  Queue transport coverage is in `server/tests/socket/game/queue/`; structural
  policy checks and case-count comparisons do not prove these runtime properties.
- Report the tested commit and the actual failing expectation, not just totals.
  Preserve Jest JSON and the real exit code when comparing runs. Missing services
  or log permissions are environment failures; do not classify them as game bugs.

## Web app checks

Run from `web/`. See `web/AGENTS.md`.

| Change type | Minimum checks | Stronger checks |
|---|---|---|
| Component/layout change | `npm run typecheck`, `npm run lint`, `npm test` | `npm run e2e:full` (all three device projects) |
| Game reducer/selectors/socket client | `npm test` | `npm run e2e:full` |
| IndexedDB draft/media persistence | `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:browser` | cross-tab races and transaction rollback in native Chromium |
| Public contract change (`openapi/schema.json`) | `npm run gen:api`, `npm run check:api`, `npm run typecheck` | `npm run e2e:full` |
| Backend gameplay change the web app relies on | backend checks above | `npm run e2e:full` from `web/` (plays a full game against the changed server) |

`npm run e2e:full` needs Docker: it starts Postgres, Redis and S3, builds and starts `server/`, seeds a demo package and runs Playwright on desktop, tablet and phone.

`npm run test:browser` starts its own Vite server and uses native Chromium APIs;
it needs `npx playwright install chromium`, but no backend or Docker.
CI runs two Playwright shards (`--shard=1/2` and `--shard=2/2`) with separate
reports and the same 10-minute global deadline per shard; local focused runs
still use one worker. Storage race tests gate application continuation after a real transaction commits,
so they exercise actual IndexedDB locking without sleeping or holding a DB lock.

## OpenAPI contract checks

| Change type | Backend check | Client check |
|---|---|---|
| REST request/response schema | `npm run validate:schema` | `npm run gen:api`, `npm run check:api`, `npm run typecheck` |
| Socket event enum/payload | `npm run validate:schema` | update `web/src/game/protocol.ts` as needed and run `npm run typecheck` |
| Public enum change | `npm run validate:schema` | generated client + affected UI compile/analyze |
| Descriptions / `x-socket-io` metadata only | schema validation, inspect emitters/types, verify no runtime shape change | generation may change comments; report generation status explicitly |

Run browser checks from `web/`. REST declarations in `web/src/api/schema.d.ts` are generated from `openapi/schema.json`. The socket protocol is maintained separately.

Contract handoff summaries should state:

- what changed in the public contract
- backend files updated
- frontend files updated or why not
- generated files included or why not

## Release script checks

Run `node --test scripts/release.test.mjs` from the repository root.
The test creates temporary repositories and uses a local bare remote.
On Windows, set `BASH_PATH` to the Git for Windows Bash executable.

## Documentation checks

Docs do not require build/test unless they change commands, generated paths, or code snippets that claim to compile.

Minimum docs review:

- Paths referenced in docs exist or are intentionally planned.
- No old architecture names are introduced.
- The doc links to the canonical source instead of duplicating it when possible.
- Any new spec is linked from an `AGENTS.md` or skill.
- Every skill has valid name/description frontmatter and a catalog entry; referenced
  skills, files, and command names resolve. Existing optional invocation/UI metadata
  is preserved. Structural validation does not replace a behavioral review of guidance.
- Current wire behavior, product targets, known defects, and verification evidence
  are distinguished rather than documented as interchangeable facts.

## Suggested verification block

Use this format in handoff summaries:

```markdown
## Verification

- [x] Reviewed docs paths for current repository structure.
- [x] `npm run validate:schema` — passed.
- [ ] `npm run test:pipeline` — not run; requires PostgreSQL/Redis and this change is docs-only.
```

Be honest. A precise “not run” is better than pretending validation happened.

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
| OpenAPI/schema only | `npm run validate:schema` | client `melos run gen_api` |
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
- Report the tested commit and the actual failing expectation, not just totals.
  Preserve Jest JSON and the real exit code when comparing runs. Missing services
  or log permissions are environment failures; do not classify them as game bugs.

## Frontend checks

Run from `client/`.

| Change type | Minimum checks | Stronger checks |
|---|---|---|
| Docs-only frontend docs | Markdown review, path sanity | none required unless commands changed |
| Pure widget/layout change | `melos run analyze` | focused widget tests, `melos run test` |
| Controller/state change | `melos run analyze`, focused tests when present | `melos run test` |
| Gameplay UI/phase/buzzer change | `melos run analyze`, focused tests when present, check `docs/specs/game-state-matrix.md` | manual scenario notes, `melos run test` |
| Localization keys | `melos run gen_locale`, `melos run analyze` | `melos run pre_build` |
| Route changes | `melos run gen_files`, `melos run analyze` | `melos run pre_build` |
| Freezed/JSON/generated model inputs | `melos run gen_files`, `melos run analyze` | `melos run pre_build`, `melos run test` |
| OpenAPI generated client change | `melos run gen_api`, `melos run gen_files`, `melos run analyze` | `melos run pre_build`, `melos run test` |
| Package editor/import/export | `melos run analyze`, focused package tests when present | `melos run test`, manual import/export notes |
| Compression/workers | `melos run pre_build`, `melos run analyze` | focused package tests/manual browser notes |

Frontend quality notes:

- Do not manually edit generated files as a shortcut.
- If user-facing strings were added and localization was not regenerated, call it out.
- Game UI changes should mention phase/role/disabled-reason impact.
- Frontend code changes should report Context7 docs fetched or why Context7 was unavailable.
- Backend readiness tests simulate client ACKs. Claims about downloaded bytes,
  hidden question text, or playback need client controller/widget or manual
  evidence with delayed preparation; see `server/docs/media-download-sync.md`.
- Check whether CI actually executed the claimed tests. At revision `8348d429`,
  `.github/workflows/test.yml` disables the client `Run Tests` step with `if: false`;
  a green client build/analyze is not Flutter test evidence. Recheck on later revisions.

## OpenAPI contract checks

| Change type | Backend check | Client check |
|---|---|---|
| REST request/response schema | `npm run validate:schema` | `melos run gen_api`, `melos run analyze` |
| Socket event enum/payload | `npm run validate:schema` | `melos run gen_api`, affected socket listener compile/analyze |
| Public enum change | `npm run validate:schema` | generated client + affected UI compile/analyze |
| Descriptions / `x-socket-io` metadata only | schema validation, inspect emitters/types, verify no runtime shape change | generation may change comments; report generation status explicitly |

Generated Dart API files live in `client/packages/openapi/`; the schema source is `openapi/schema.json`.

Contract handoff summaries should state:

- what changed in the public contract
- backend files updated
- frontend files updated or why not
- generated files included or why not

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
- [ ] `melos run analyze` — not run; no client code changed.
```

Be honest. A precise “not run” is better than pretending validation happened.

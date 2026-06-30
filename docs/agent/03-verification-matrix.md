# Verification matrix

Use this matrix to choose checks for agent-created changes. Not every task needs every command, but every PR summary should say what was run and what was not run.

## General rule

Run the narrowest reliable checks for the touched area. If a check needs unavailable infrastructure, say so and run the next best static/type/schema checks.

## Backend checks

Run from `server/`.

| Change type | Minimum checks | Stronger checks |
|---|---|---|
| Docs-only backend docs | Markdown review, link/path sanity | none required unless commands changed |
| TypeScript compile-sensitive change | `npm run lint`, `npm run build` | focused Jest test |
| REST endpoint/controller/scheme | `npm run lint`, `npm run build`, `npm run validate:schema` | focused REST tests, `npm test` |
| Socket event/action/use case | `npm run lint`, `npm run build`, `npm run validate:schema` if public contract changed | focused socket/game tests, queue-sensitive test |
| Game state/domain logic | `npm run lint`, `npm run build`, focused Jest tests | `npm test` with PostgreSQL + Redis |
| Redis lock/queue/timer logic | `npm run lint`, `npm run build`, focused integration tests | `npm test`, load/reconnect scenario when available |
| DB model/repository/migration | `npm run lint`, `npm run build` | migration/integration test against PostgreSQL |
| Logging/metrics/admin diagnostics | `npm run lint`, `npm run build` | focused endpoint/service tests |
| OpenAPI/schema only | `npm run validate:schema` | client `melos run gen_api` |

Backend test rules:

- Do not use `setTimeout` to wait for game timers in tests; use `TestUtils.expireTimer()`.
- Do not increase test timeouts to hide missing events.
- Tests requiring PostgreSQL/Redis must say so when not run.

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

## OpenAPI contract checks

| Change type | Backend check | Client check |
|---|---|---|
| REST request/response schema | `npm run validate:schema` | `melos run gen_api`, `melos run analyze` |
| Socket event enum/payload | `npm run validate:schema` | `melos run gen_api`, affected socket listener compile/analyze |
| Public enum change | `npm run validate:schema` | generated client + affected UI compile/analyze |

Contract PR summaries should state:

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

## Suggested PR verification block

Use this format in PR summaries:

```markdown
## Verification

- [x] Reviewed docs paths for current repository structure.
- [x] `npm run validate:schema` — passed.
- [ ] `npm test` — not run; requires PostgreSQL/Redis and this PR is docs-only.
- [ ] `melos run analyze` — not run; no client code changed.
```

Be honest. A precise “not run” is better than pretending validation happened.

# AGENTS.md — OpenQuester

## Project Overview

OpenQuester is a multiplayer quiz game. Independent sub-projects (no workspaces):
- `server/` — TypeScript/Node.js backend (Express, Socket.IO, PostgreSQL, Redis)
- `client/` — Flutter/Dart frontend
- `loadtest/` — TypeScript load testing tool (imports server domain types via path aliases)
- `openapi/` — OpenAPI schema (`schema.json`) + generated Dart SDK
- `websites/` — Hugo docs and landing page

Node version: 20.12 (`server/.node-version`). Build target: Node 18 (tsup).

## Build / Lint / Test Commands

### Server (run from `server/`)

```bash
npm run start:dev          # Dev server (build + watch + nodemon)
npm run build              # Production build (clean + tsc --noEmit + tsup)
npm run lint               # ESLint 9 flat config
npm test                   # All tests (Jest, serial, requires PostgreSQL + Redis)
npx jest tests/game/someTest.test.ts   # Single test file
npx jest -t "should create game"       # Tests matching name pattern
npm run test:pipeline      # CI mode (stdout suppressed)
npm run validate:schema    # Validate OpenAPI schema
```

### Loadtest (run from `loadtest/`)

```bash
npm run build              # clean + tsc --noEmit + tsup
npm run dev                # ts-node with tsconfig-paths (runs src/index.ts)
npm start                  # node dist/index.js (after build)
```

### Client (run from `client/`)

```bash
flutter pub get            # Install dependencies
dart run build_runner build --delete-conflicting-outputs  # Code generation
flutter analyze            # Lint (very_good_analysis)
flutter test               # Run tests
dart format .              # Format code
./oqhelper gen_locale      # Regenerate localization keys
```

### Dev Infrastructure (from `server/`)

```bash
docker compose up -d       # PostgreSQL 16, Redis, MinIO, pgAdmin, Prometheus, Grafana
```

CI requires: PostgreSQL 15, Redis 7. Env vars: `NODE_ENV=test`, `SESSION_SECRET=test_secret`, `REDIS_URL=redis://localhost:6379/12`, `DB_HOST/PORT/USERNAME/PASSWORD/DATABASE`.

## Server Architecture

4-layer clean architecture — dependencies flow inward only:

```
presentation/ → application/ → domain/
                     ↓
              infrastructure/
```

- **`domain/`** — Pure logic, entities, enums, DTOs, errors, validators, state machine. No external deps.
- **`application/`** — Services, DI (tsyringe), handlers, workers, jobs, usecases, factories.
- **`infrastructure/`** — TypeORM (PostgreSQL), ioredis, S3/MinIO, pino logger, config.
- **`presentation/`** — REST controllers, Socket.IO handlers/emitters, Express middleware, Joi schemes.

**Path aliases** (`tsconfig.json` + `jest.config.ts`): `domain/*`, `application/*`, `infrastructure/*`, `presentation/*`, `tests/*`

### Socket Events — extend `BaseSocketEventHandler<TInput, TOutput>`: `validate()` → `execute()` → `broadcast()`. Auto-registered via `SocketEventHandlerRegistry`.

### Action Queue — `GameActionExecutor` + Redis lock per game prevents concurrent state corruption. Game state stored in Redis as serialized `GameStateDTO`.

### DI — tsyringe: `@singleton()` for concrete classes; `@inject(DI_TOKENS.X)` with `Symbol.for()` tokens for interfaces (see `application/di/tokens.ts`, registrations in `application/di/bootstrap.ts`).

### REST Controllers — class-based with Express `Router`. Wrap handlers with `asyncHandler`. Validate with `RequestDataValidator` + Joi schemes (`presentation/schemes/`). Use `HttpStatus` enum.

## Code Style

### Imports
- Path aliases, not relative paths: `import { Game } from "domain/entities/game/Game"`
- `type` keyword for type-only imports: `import { type NextFunction } from "express"`
- Order: external packages → internal by layer (domain → application → infrastructure → presentation)
- Named imports only. **No default exports. No re-exports. No `index.ts` barrel files.**

### Naming Conventions
- **Files & Classes:** `PascalCase` — filename matches the exported class/interface/enum
- **Variables & functions:** `camelCase` | **Constants:** `UPPER_SNAKE_CASE`
- **Enums:** `PascalCase` name, `UPPER_SNAKE_CASE` or `"kebab-case"` values
- **DB columns:** `snake_case` (TypeORM `SnakeNamingStrategy`)
- **Suffixes:** `*Service`, `*Repository`, `*EventHandler` | **Unused params:** `_` prefix

### Type Safety
- **Never use `any`** — use `unknown` or `Record<string, T>`
- Explicit return types on all public methods
- `satisfies` on untyped objects for type checking without widening
- `interface` for DTOs/contracts; `type` for unions/aliases
- DTOs live in `domain/types/dto/`, always interfaces, use mappers to convert

### Error Handling
- `BaseError` → `ClientError` (400, user-facing, translated) / `ServerError` (500, internal)
- Throw in services/repositories → `asyncHandler` → `errorMiddleware` → `ErrorController.resolveError`
- Client errors not logged (expected); server errors logged
- Supply `textArgs` for translated string interpolation in client errors

### Logging
- `ILogger` abstraction (pino): `logger.info("msg", { prefix: LogPrefix.GAME })`
- Performance: `const perf = logger.performance("op", { prefix }); ... perf.finish();`
- JSDoc `/** */` on classes and public methods; `//` for inline notes

### Database
- TypeORM with manual migrations in `infrastructure/database/migrations/`
- `SnakeNamingStrategy` for columns. Repositories as `@singleton()` wrapping TypeORM repos.
- Redis: namespaced keys (e.g. `game:{gameId}`), keyspace notifications + handlers

### Testing
- Jest with `ts-jest`, serial (`maxWorkers: 1`). Setup: `tests/setup.ts`. Bootstrap: `tests/TestApp.ts`
- Timer testing: **always** use `TestUtils.expireTimer()` — **never `setTimeout`**
- **Never increase test timeouts** — missing events indicate broken code
- Tests require running PostgreSQL and Redis instances

## ESLint Rules (Key)

- `@typescript-eslint/no-floating-promises: error` — must await or void promises
- `node/no-sync: error` — no synchronous I/O
- `@typescript-eslint/no-unused-vars: error` — prefix unused with `_`
- `no-implicit-globals: error` | `promise/no-callback-in-promise: warn`

## Client (Flutter/Dart)

- Architecture: `core/` (DI, routing, theme) → `features/` (controller/data/view/utils) → `data/` → `ui/` → `connection/`
- Files: `snake_case` | Classes: `PascalCase` | Private: `_prefix` | Use `common_imports.dart`
- DI: `get_it` + `@singleton` + `createOnce` | State: `ValueNotifier`, `StreamController`
- Widgets: `StatefulWidget` or `WatchingWidget` (reactive via `watchValue`/`watchIt`)
- Localization: `easy_localization` — edit JSON in `assets/localization/` → `./oqhelper gen_locale` → `LocaleKeys.*`
- Navigation: Auto Route (`@RoutePage()`, `.push(context)`)
- Lint: `very_good_analysis`. Max 300-400 lines/file. Fix linting before commit.

## Commit Conventions

- Conventional commits: `feat:`, `fix:`, `refactor:`, etc.
- MVP-first: minimal diff, zero side effects
- No formatting-only changes, no unrelated edits, no unnecessary refactors
- Architecture changes only when explicitly requested

## Key Files

| Purpose | Path |
|---|---|
| DI tokens | `server/src/application/di/tokens.ts` |
| DI bootstrap | `server/src/application/di/bootstrap.ts` |
| Server entry | `server/src/presentation/index.ts` |
| Test bootstrap | `server/tests/TestApp.ts` |
| Error hierarchy | `server/src/domain/errors/{BaseError,ClientError,ServerError,ErrorController}.ts` |
| ESLint config | `server/eslint.config.mjs` |
| Docker Compose | `server/compose.yml` |
| Copilot instructions | `.github/copilot-instructions.md` |
| Backend instructions | `.github/instructions/backend.instructions.md` |
| Frontend instructions | `.github/instructions/frontend-core.instructions.md` |
| Frontend patterns | `.github/instructions/frontend-patterns.instructions.md` |

## Important Docs

- `server/docs/final-round-flow.md` — Theme elimination → bidding → answering → reviewing
- `server/docs/game-action-executor.md` — Race condition prevention via Redis locks
- `server/docs/media-download-sync.md` — Cross-client media synchronization
- `server/docs/logging-guidelines.md` — Structured logging conventions

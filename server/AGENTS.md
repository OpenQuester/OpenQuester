# server/AGENTS.md — backend source of truth

Use this file for all changes under `server/`. The root `AGENTS.md` is only a router; this file owns backend architecture and coding rules.

## Runtime and commands

Node version: `20.12` from `.node-version`. Build target is Node 18 through `tsup`.

Run commands from `server/`:

```bash
npm run start:dev          # validate schema + lint + watch build + nodemon
npm run validate:schema    # validate ../openapi/schema.json
npm run lint               # ESLint 9 flat config
npm run build              # clean + tsc --noEmit + tsup
npm test                   # Jest; requires PostgreSQL + Redis
npm run test:pipeline      # CI-mode Jest output
npx jest path/to/test.ts   # focused test file
npx jest -t "test name"    # focused test name
```

Test dependencies: PostgreSQL and Redis. Local infra is started from `server/` with:

```bash
docker compose up -d
```

## Architecture layers

```text
bootstrap/  -> composition root; may import all layers
presentation -> application -> domain
application -> infrastructure only where current pragmatic code already does so
shared/     -> dependency-neutral config, DI tokens, logging contracts, context types
```

Layer responsibilities:

- `domain/` — pure logic, entities, enums, DTOs, mappers, validators, errors, state machine. No I/O and no imports from application/infrastructure/presentation.
- `application/` — use cases, orchestration services, action executors, workers, jobs, ports, factories. No presentation imports and no Socket.IO/Express transport APIs.
- `infrastructure/` — TypeORM/PostgreSQL, Redis, S3/MinIO, pino implementation, migrations, storage/database adapters.
- `presentation/` — Express REST controllers, Socket.IO setup/dispatching, realtime adapter, middleware, Joi schemes. Do not import infrastructure directly.
- `shared/` — DI tokens, config, logger contracts, request/socket context types. Must remain dependency-neutral.
- `bootstrap/` — composition root; registers runtime objects, concrete adapters, repositories, action handlers, cron jobs, and translation setup.

Path aliases are configured in `tsconfig.json` and Jest:

- `domain/*`
- `application/*`
- `infrastructure/*`
- `presentation/*`
- `shared/*`
- `bootstrap/*`
- `tests/*`

Use aliases, not deep relative paths.

## Dependency injection

Current DI source of truth:

- Tokens: `src/shared/di/tokens.ts`
- Bootstrap: `src/bootstrap/bootstrapContainer.ts`
- Runtime entry: `src/ServeApi.ts`

Use `@singleton()` for concrete injectable classes. Use `@inject(DI_TOKENS.X)` for interfaces/ports and external runtime objects. Do not create a second container or revive legacy `application/Container.ts` patterns.

## Socket/game action architecture

Current game-changing socket flow:

```text
SocketIOInitializer
  -> SocketActionDispatcher
  -> SocketActionMap
  -> GameActionExecutor
  -> GameActionHandler/use case
  -> DataMutationProcessor
  -> RealtimeGateway / Redis / timer / stats side effects
```

Rules:

- `SocketActionMap.ts` is the single source of truth for public socket event → `GameActionType` mappings.
- Presentation validates/normalizes payloads and builds `GameAction` objects; it does not mutate game state.
- Game-changing actions use `GameActionExecutor.submitAction(...)` and are serialized per game through the Redis queue/lock.
- Only non-mutating actions, such as chat-style reads/broadcasts, may use `submitDirectAction(...)` and `directExecution: true`.
- Use cases return `ActionHandlerResult` with `DataMutation[]`; they do not directly write Redis or emit Socket.IO.
- Application realtime output goes through `application/ports/realtime/RealtimeGateway` or broadcast mutations, not direct Socket.IO imports.
- Transport-specific socket context changes belong in presentation hooks only when the side effect is truly transport-level.

Before adding/changing a socket action, read:

- `.agents/skills/backend-socket-action/SKILL.md`
- `server/docs/how-to-add-socket-action.md`
- `server/docs/game-action-executor.md`
- `docs/specs/game-state-matrix.md` if gameplay state changes

## REST architecture

REST controllers are class-based and use Express `Router`.

Rules:

- Register routes in presentation controllers.
- Wrap async handlers with `asyncHandler`.
- Validate request data with `RequestDataValidator` and Joi schemes from `presentation/schemes/`.
- Delegate business logic to application services/use cases.
- Return `HttpStatus` enum values where possible.
- Do not put TypeORM entities, Socket.IO objects, or infrastructure clients on `req`; use `req.auth` for request identity.

## Domain and state-machine rules

The game is stateful and realtime. Small-looking changes can break fairness.

When touching game state:

- Inspect `domain/entities/game/Game.ts` and relevant domain logic/validators.
- Preserve score clamps, No Risk behavior, eligibility rules, skipped/answered player semantics, timers, and final-round phase rules.
- Update `docs/specs/game-state-matrix.md` or a feature-specific spec when a phase, role, CTA, timer, or disabled reason changes.
- Add tests for race-sensitive behavior and invalid payloads.

## Error handling

Error hierarchy:

- `BaseError`
- `ClientError` — expected/user-facing, translated where needed, normally not logged as server failures.
- `ServerError` — internal/server-side, logged.
- `ErrorController.resolveError(...)` centralizes resolution.

Throw typed errors from services/repositories/use cases. Let `asyncHandler` + `errorMiddleware` + `ErrorController` handle REST responses. Socket dispatchers should emit resolved client errors to the origin socket.

## Logging and metrics

- Use `ILogger` abstraction, not direct `console.*`.
- Include `LogPrefix` and useful context (`gameId`, `actionId`, `actionType`, `userId`, `socketId`) where available.
- Use `logger.performance(...)` for timed operations.
- Avoid logging expected client errors as server failures.
- Keep logs safe: no session secrets, raw passwords, tokens, or unnecessary PII.

## Type and import style

- Named exports only. No default exports.
- No `index.ts` barrels or re-exports in server code.
- Use `import type` for type-only imports.
- Prefer `unknown` or typed records over `any`; if an existing boundary still allows `any`, do not spread it further.
- Public methods need explicit return types.
- DTO contracts live in `domain/types/dto/` as interfaces when practical.

## Testing rules

- Jest runs serially (`maxWorkers: 1`).
- Use `tests/TestApp.ts` for integration setup.
- Timer tests must use `TestUtils.expireTimer()`; do not use `setTimeout` as a test synchronization mechanism.
- Do not increase test timeouts to hide missing events.
- For socket/game changes, cover success, validation failure, permission/role failure, and queue-sensitive cases when applicable.

## Important backend references

- `src/shared/di/tokens.ts` — DI tokens.
- `src/bootstrap/bootstrapContainer.ts` — DI/composition root.
- `src/ServeApi.ts` — API server composition.
- `src/application/executors/GameActionExecutor.ts` — queued action execution.
- `src/application/executors/DataMutationProcessor.ts` — declared side effects.
- `src/presentation/controllers/io/SocketActionDispatcher.ts` — socket dispatch loop.
- `src/presentation/controllers/io/SocketActionMap.ts` — socket event map.
- `src/application/ports/realtime/RealtimeGateway.ts` — realtime port.
- `src/presentation/realtime/SocketIORealtimeGateway.ts` — Socket.IO adapter.
- `server/docs/game-action-executor.md` — queue/lock details.
- `server/docs/how-to-add-socket-action.md` — implementation steps.
- `server/docs/final-round-flow.md` — final round behavior.
- `server/docs/media-download-sync.md` — media readiness/sync behavior.

## Stale patterns to reject

Do not follow older docs/snippets that mention these as current architecture:

- `BaseSocketEventHandler<TInput, TOutput>`
- `SocketEventHandlerRegistry`
- `application/Container.ts`
- `presentation/index.ts` as socket registration root
- `domain/orchestrators/GameOrchestrator.ts`

If a task intentionally reintroduces any of them, document the architecture decision and migration plan first.

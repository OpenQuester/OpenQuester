# OpenQuester server instructions

## Environment and commands

- Use Node `20.12` from `.node-version`; tsup emits for Node 18.
- Run commands from `server/`.
- Start development infrastructure with `docker compose up -d` when PostgreSQL, Redis, MinIO, or observability services are required.
- Prefer a targeted Jest file or `-t` pattern before the full suite.
- Standard checks are `npm run lint`, `npm run build`, and the smallest relevant Jest suite.
- Run `npm run validate:schema` when the OpenAPI schema or its server contract changes.
- Tests require PostgreSQL and Redis. CI uses PostgreSQL 15 and Redis 7 with the environment in `.github/workflows/test.yml`.

## Architecture boundaries

```text
bootstrap/       composition root; may import every layer
presentation/ -> application/ -> domain/
                  application -> infrastructure/ where current code does so
shared/          dependency-neutral contracts, configuration, logging, and context types
```

- `domain/` contains pure logic, entities, DTOs, errors, validators, and state transitions. It must not import application, infrastructure, presentation, or external I/O.
- `application/` owns use cases, orchestration, workers, jobs, factories, and application ports. It must not import presentation or transport-specific Express/Socket.IO APIs.
- `infrastructure/` owns TypeORM/PostgreSQL, Redis, S3/MinIO, migrations, logging implementations, and external adapters. It must not import application or presentation.
- `presentation/` owns REST, Socket.IO, middleware, validation schemes, and transport adapters. It must not import infrastructure directly.
- `bootstrap/` wires DI and runtime objects.
- Treat `eslint.config.mjs` as the executable source of truth for enforced import boundaries. Do not bypass a boundary with type-only imports or ESLint disables.
- Application code may use existing infrastructure repositories/adapters directly. Do not introduce repository interfaces only for architectural ceremony; add application-owned ports when they provide a concrete boundary benefit.

Path aliases are `domain/*`, `application/*`, `infrastructure/*`, `presentation/*`, `shared/*`, `bootstrap/*`, and `tests/*`.

## Distributed correctness

Production may run independent server instances behind a load balancer without sticky sessions. HTTP auth, Socket.IO events, timers, and queued actions may execute on different instances.

- Process-local state may own local lifecycle, sockets, logger streams, metrics buffers, immutable configuration, and test-only harness state. It must not be authoritative for game correctness.
- Shared correctness belongs in PostgreSQL, Redis game/session/timer state, Redis action queues and locks, distributed cron locks, and Socket.IO Redis-adapter operations.
- Do not replace Redis-backed action ordering, locks, timers, socket/session metadata, or cron ownership with a local `Map`, `Set`, array, promise chain, `EventEmitter`, or mutex.
- `namespace.sockets` is process-local. Use adapter-aware operations such as `to(room).emit`, `in(room).fetchSockets`, `socketsJoin`, `socketsLeave`, `disconnectSockets`, or `serverSideEmit` for cluster-wide behavior.
- A local cache is acceptable only when PostgreSQL or Redis remains authoritative, or when reconstruction after eviction/restart cannot change behavior.
- Tests may use in-memory journals, actors, and harness state under `tests/`; production code must not depend on those helpers.
- When state ownership is unclear, identify whether it is local or distributed before implementing the change.

Read `docs/multi-instance-invariants.md` before changing server lifecycle, Socket.IO routing, game actions, timers, queues, or cron ownership.

## Core flows

- `SocketIOInitializer` and `SocketActionDispatcher` map Socket.IO events to `GameAction` values and submit them to `GameActionExecutor`.
- `GameActionExecutor` and a Redis lock per game protect action ordering and state mutation.
- Game state is stored in Redis as serialized `GameStateDTO` data.
- Application realtime output goes through `application/ports/realtime/RealtimeGateway`; Socket.IO delivery belongs in `presentation/realtime/SocketIORealtimeGateway.ts`.
- Request identity belongs in `req.auth` (`RequestAuthContext`). Do not attach TypeORM entities or transport objects to Express requests.

## Server conventions

- Follow existing path-alias import ordering. Use `type` imports for type-only dependencies.
- Use named exports. Do not introduce default exports or barrel `index.ts` files; `src/index.ts` remains the executable entrypoint.
- Do not introduce new `any` when `unknown`, a precise type, or a constrained record works. Do not expand existing untyped boundaries as unrelated cleanup.
- Use `@singleton()` for concrete classes and `@inject(DI_TOKENS.X)` for interfaces/ports. Tokens live in `src/shared/di/tokens.ts`; registrations live in `src/bootstrap/bootstrapContainer.ts`.
- REST controllers are class-based. Wrap async handlers with `asyncHandler`, validate through `RequestDataValidator` and Joi schemes, and use `HttpStatus`.
- Preserve the `BaseError` -> `ClientError` / `ServerError` flow. Supply `textArgs` when translated client errors require interpolation.
- Keep TypeORM migrations manual and data-preserving under `src/infrastructure/database/migrations/`.
- Use namespaced Redis keys and follow existing keyspace-notification handlers.

## Testing

- Jest runs serially through `tests/setup.ts` and `tests/TestApp.ts`.
- Use `TestUtils.expireTimer()` to manipulate game timer expiration. Do not replace game-timer control with arbitrary sleeps.
- Bounded `setTimeout` calls remain valid for harness deadlines, aborts, and explicit polling.
- Do not raise test timeouts merely to hide missing events, leaked resources, or broken synchronization; diagnose the cause first.

## Navigation

- DI: `src/shared/di/tokens.ts`, `src/bootstrap/bootstrapContainer.ts`
- Server lifecycle: `src/index.ts`, `src/ServeApi.ts`
- Socket dispatch: `src/presentation/controllers/io/SocketActionDispatcher.ts`
- Realtime port/adapter: `src/application/ports/realtime/RealtimeGateway.ts`, `src/presentation/realtime/SocketIORealtimeGateway.ts`
- Action execution: `src/application/executors/GameActionExecutor.ts`
- Test bootstrap: `tests/TestApp.ts`
- Key docs: `docs/game-action-executor.md`, `docs/multi-instance-invariants.md`, `docs/final-round-flow.md`, `docs/media-download-sync.md`, `docs/logging-guidelines.md`

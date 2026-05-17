# Server Source Guide

This directory follows a layered backend structure. Use this guide to decide where new code belongs and which direction dependencies should flow.

## Dependency Rule

```text
presentation -> application -> domain
application -> infrastructure
all layers -> shared
```

Keep dependencies moving inward. `shared/` is the only cross-layer exception and is reserved for project-wide primitives that do not express business use cases, transport handling, persistence, or adapter behavior.

## Layers

### `domain/`

Pure game and business rules.

Import rule: may import `domain/*` only; must not import `application/*`, `infrastructure/*`, or `presentation/*`.

Contains:

- Entities and value objects
- Enums, constants, DTOs, and shared types
- Validators and mappers
- Game logic and state-machine transitions
- Domain errors

Use for:

- Rules that can run without Express, Socket.IO, Redis, or PostgreSQL
- Game state changes on in-memory entities
- Phase transition decisions
- Validation that does not need external I/O

Avoid:

- Database or Redis calls
- Socket emits
- Request/response objects
- Runtime configuration or environment access

### `application/`

Use-case orchestration and application workflows.

Import rule: may import `domain/*`, `shared/*`, and currently concrete `infrastructure/*`; must not import `presentation/*`.

Contains:

- Use cases
- Application services
- Game action executor and mutation processor
- Registries and factories
- Jobs and workers

Use for:

- Coordinating domain rules with infrastructure services
- Executing socket game actions
- Returning `DataMutation[]` for state saves, timers, broadcasts, stats, and cleanup
- Scheduling background work
- Wiring dependencies through DI

Avoid:

- Parsing HTTP request payloads
- Defining TypeORM models or migrations
- Putting reusable game rules directly in services when they can live in `domain/`

### `infrastructure/`

Adapters for external systems.

Import rule: may import `domain/*`, `infrastructure/*`, and `shared/*`; must not import `application/*` or `presentation/*`.

Contains:

- TypeORM models, repositories, and migrations
- Redis services, locks, queues, and cache adapters
- Storage adapters
- Logger implementation
- Metrics and external-service clients

Use for:

- PostgreSQL access
- Redis access
- File storage
- Logging and metrics adapters
- External integrations

Avoid:

- Game rule decisions
- HTTP or Socket.IO event mapping
- Request payload validation

### `presentation/`

Transport layer.

Import rule: may import `application/*`, `domain/*`, `presentation/*`, and `shared/*`. Do not import `infrastructure/*` except in explicit composition-root files that instantiate concrete adapters, such as the server entrypoint.

Contains:

- REST controllers
- Socket.IO initializer, dispatcher, hooks, and action map
- Middleware
- Joi request schemes
- Server entrypoints

Use for:

- Registering HTTP routes
- Registering Socket.IO event listeners
- Validating transport payloads
- Auth, permission, correlation, error, and performance middleware
- Translating transport input into application calls

Avoid:

- Business decisions
- Database or Redis access
- Direct game state mutation
- Type-only imports from infrastructure models or repositories; move shared request/response types to `domain/*` or `shared/*` instead

### `shared/`

Project-wide primitives and cross-cutting contracts.

Import rule: may import `domain/*` only when it needs stable primitive types/constants; must not import `application/*`, `presentation/*`, or concrete infrastructure adapters.

Contains:

- DI tokens
- Runtime configuration entrypoints
- Logging contracts, prefixes, tags, and async log context

Use for:

- Values and contracts used by multiple layers without expressing a layer-specific concept
- Composition identifiers like `DI_TOKENS`
- Cross-cutting context like request correlation

Avoid:

- Repositories, services, controllers, use cases, adapters, and business rules
- Dumping utilities here just to avoid choosing a real layer

## Common Flows

### REST Request

```text
Controller -> RequestDataValidator/Joi scheme -> application service -> service/repository -> response
```

Keep controllers thin. They should validate input, call an application service, and return an HTTP response.

### Socket Game Action

```text
SocketActionDispatcher -> SocketActionMap -> GameActionExecutor -> UseCase -> DataMutationProcessor
```

Game-changing socket actions go through the per-game lock and queue. Use cases mutate the in-memory `Game` entity and return `DataMutation[]`. `DataMutationProcessor` is the place that turns declared mutations into Redis writes, socket broadcasts, stats updates, and cleanup.

### Game Rule

```text
UseCase -> domain logic/validator/state-machine -> DataMutation[]
```

Put reusable rules in `domain/`. Keep I/O and orchestration in `application/`.

## Where To Add Code

| Task | Start here |
| --- | --- |
| New REST endpoint | `presentation/controllers/rest/`, `presentation/schemes/`, application service |
| New socket game event | `domain/enums/SocketIOEvents.ts`, `domain/enums/GameActionType.ts`, `presentation/controllers/io/SocketActionMap.ts`, use case, `application/config/ActionHandlerConfig.ts` |
| New game rule | `domain/logic/`, `domain/validators/`, or `domain/state-machine/` |
| New game-state side effect | `domain/types/action/DataMutation.ts` and `application/executors/DataMutationProcessor.ts` |
| New database table | `infrastructure/database/models/`, `infrastructure/database/migrations/`, repository |
| New Redis behavior | `infrastructure/database/repositories/RedisRepository.ts` or a dedicated infrastructure adapter |
| New scheduled job | `application/jobs/` and `application/factories/CronJobFactory.ts` |

## Boundary Enforcement

ESLint enforces the cleaned infrastructure boundary:

```text
src/infrastructure/** must not import application/* or presentation/*
```

When a fixed layer is cleaned, add a matching `no-restricted-imports` rule so it cannot regress.

## Related Docs

- `../docs/contributing-server.md`
- `../docs/how-to-add-rest-endpoint.md`
- `../docs/how-to-add-socket-action.md`
- `../docs/how-to-add-game-logic.md`
- `../docs/game-action-executor.md`
- `../docs/websocket-game-flow/README.md`
- `../docs/final-round-flow.md`
- `../docs/logging-guidelines.md`
- `../docs/media-download-sync.md`

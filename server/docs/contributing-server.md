# Server Contribution Guide

This guide is for small, safe backend changes. Prefer minimal diffs, clear ownership, and code that fits the existing layers.

## Before Adding Code

- Find the existing flow first. Most features already have a nearby service, use case, validator, or repository.
- Keep new code in the layer that owns the responsibility.
- Prefer extending an existing class or flow over creating a parallel abstraction.
- Do not add compatibility paths unless there is persisted data, shipped behavior, external consumers, or an explicit requirement.

## Layer Checklist

| If you are adding... | Put it in... |
| --- | --- |
| HTTP route or middleware | `src/presentation/` |
| Socket.IO event mapping | `src/presentation/controllers/io/` |
| Use-case workflow | `src/application/usecases/` |
| Application coordination service | `src/application/services/` |
| Game rule or state transition | `src/domain/logic/`, `src/domain/validators/`, `src/domain/state-machine/` |
| Shared DTO/type/enum | `src/domain/types/` or `src/domain/enums/` |
| PostgreSQL access | `src/infrastructure/database/` |
| Redis, storage, metrics, logging adapter | `src/infrastructure/` |

## Dependency Rules

- `presentation` can call `application` and use `domain` types.
- `application` can call `domain` and `infrastructure`.
- `infrastructure` implements external-system access.
- `domain` should not know about Express, Socket.IO, Redis, PostgreSQL, or runtime config.

## Coding Rules

- Use path aliases such as `domain/entities/game/Game`, not relative imports across layers.
- Use named exports. Do not add default exports or barrel files.
- Use `type` imports for type-only imports.
- Keep public method return types explicit.
- Do not use `any`; use `unknown`, concrete DTOs, or typed records.
- Throw `ClientError` for expected user-facing failures and `ServerError` for internal failures.
- Log at boundaries and business outcomes only. See `logging-guidelines.md`.

## DI Rules

- Use `@singleton()` for concrete services that should be resolved by the container.
- Use `@inject(DI_TOKENS.X)` when injecting interfaces or runtime-created dependencies.
- Register runtime dependencies in `src/application/di/bootstrapContainer.ts`.
- Register game action handlers in `src/application/config/ActionHandlerConfig.ts`.

## Testing And Verification

- Run `npm run lint` for documentation-adjacent code changes that touch TypeScript.
- Run `npm run build` when changing types, DI, or cross-layer wiring.
- Run focused Jest tests for behavior changes.
- Socket game tests require PostgreSQL and Redis.
- Timer tests should use existing test utilities rather than real sleeps.

## Related Guides

- Source map: `../src/README.md`
- REST endpoint flow: `how-to-add-rest-endpoint.md`
- Socket action flow: `how-to-add-socket-action.md`
- Game logic placement: `how-to-add-game-logic.md`

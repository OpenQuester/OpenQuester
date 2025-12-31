---
applyTo: "server/**/*"
---

# OpenQuester Backend Instructions

## Important Documentation References

Before working on backend code, familiarize yourself with these key documents:

- **Final Round Flow:** `server/docs/final-round-flow.md` - Comprehensive guide to final round phases (theme elimination → bidding → answering → reviewing)
- **Game Action Executor:** `server/docs/game-action-executor.md` - Critical understanding of the action queue system that prevents race conditions
- **Media Sync:** `server/docs/media-download-sync.md` - How media synchronization works across clients

These documents provide essential context for game mechanics and technical architecture decisions.

## Architecture Overview

**Clean Architecture (4 layers):**

- `domain/` - Pure business logic, entities, handlers, state machines
- `application/` - Use cases, services, orchestrators (connects domain ↔ infrastructure)
- `infrastructure/` - External concerns: database (TypeORM), Redis, S3, logger
- `presentation/` - Express REST controllers, Socket.IO handlers, validation schemes

**Key Pattern:** Dependency injection via `Container` (symbol-based registry in `application/Container.ts`). All services/repositories registered at startup.

## Core Concepts

### Socket Event Handlers

All Socket.IO game events extend `BaseSocketEventHandler<TInput, TOutput>`:

- Template method pattern: `validate()` → `execute()` → `broadcast()`
- Auto-registered via `SocketEventHandlerRegistry`
- Examples: `server/src/domain/handlers/socket/game/StartGameEventHandler.ts`

### Action Queue System (Critical for Game State)

**Problem:** Multiple socket events arriving simultaneously could corrupt game state.

**Solution:** `GameActionExecutor` + `GameActionQueueService` + `GameActionLockService`

- Each game action acquires distributed lock (Redis)
- If locked → queue action with callback (preserves socket context)
- After execution → release lock, process queued actions recursively
- See: `server/src/application/executors/GameActionExecutor.ts`

**Usage in handlers:**

```typescript
protected async executeAction(data: TInput): Promise<GameActionResult> {
  const action: GameAction = {
    id: uuidv4(),
    type: GameActionType.QUESTION_PICK,
    gameId: this.gameId,
    // ... action data
  };
  return this.actionExecutor.submitAction(action, async (action) => {
    // Actual execution logic here
  });
}
```

### Game State Management

- Game state stored in **Redis** (serialized GameStateDTO)
- Retrieved via `SocketGameContextService.getFullGameContext()`
- Updated atomically within action queue handlers
- Round progression uses factory pattern (`RoundHandlerFactory`)

### Validation

- REST: Joi schemas in `presentation/schemes/` + `RequestDataValidator`
- Socket: Built into handler's `validate()` method, utilizes Joi schemas as well
- Game rules: Dedicated validators in `domain/validators/` (e.g., `GameStateValidator`)

## Development Workflows

### Running Tests

```bash
npm test                    # All tests (sequential, maxWorkers=1)
npm run test:pipeline       # CI-friendly (suppresses output)
```

Tests mimic client requests + validate DB/Redis state directly. See `tests/TestApp.ts` for bootstrap pattern.

For running specific tests (can be useful for investigation with "trace" logs set in `tests/utils.ts`):

```bash
npx jest path/to/testfile.ts
```

### Critical Build Details

- Path aliases configured in `tsconfig.json` + `jest.config.ts`:
  - `application/*`, `domain/*`, `infrastructure/*`, `presentation/*`
- Build: `tsup` (bundler) excludes `__tests__` and `*.test.*`
- TypeScript: **strict mode** enforced

## Project-Specific Conventions

### Naming & Structure

- **Services** end with `Service` (e.g., `GameService`, `UserService`)
- **Repositories** end with `Repository` (database layer only)
- **Handlers:** Socket events = `*EventHandler`, Redis expirations = `*ExpirationHandler`
- **Enums:** `PascalCase` names, values in `SCREAMING_SNAKE_CASE` or `"kebab-case"`
- **DTOs:** Located in `domain/types/dto/`, always interfaces, using mappers to manipulate data

### Error Handling

- **Client errors:** `ClientError` (domain layer) with `ClientResponse` enum - only errors returned to clients, always translated
- **Server errors:** `ServerError` with `ServerResponse` enum - server errors, no need to translate
- `ErrorController.handleAsync()` wraps all async operations
- Never throw raw strings or generic Errors

### Redis Patterns

- Keys: Namespaced (e.g., `game:{gameId}`, `timer:{timerId}`)
- Expirations: Handled via `keyspace` notifications + `RedisExpirationHandler`
- Pub/Sub: `RedisPubSubService` for cross-instance coordination (Socket.IO multi-server)

### TypeORM Details

- **Migrations:** Manually written in `infrastructure/database/migrations/`
- **Naming:** Snake case via `SnakeNamingStrategy`
- **Models:** Located in `infrastructure/database/models/`
- No auto-sync in production (migrations only)

## Critical Files Reference

- DI Container: `application/Container.ts`
- Socket setup: `presentation/index.ts` (Express + Socket.IO + Redis adapter)
- Test bootstrap: `tests/TestApp.ts`
- Game orchestrator: `domain/orchestrators/GameOrchestrator.ts`
- Final round logic: `docs/final-round-flow.md` (detailed phase transitions)

## Type Safety Rules

- **Never** use `any` → use `unknown` or `Record<string, T>`
- Avoid `Object` type
- Explicit return types on all functions
- Strict null checks enabled
- use `satisfies` on un-typed objects, e.g. socket event body.
- **Never** use re-exports, never create `index.ts` files to re-export modules.

## Testing Philosophy

Tests simulate **client-side requests** (REST + Socket.IO) and validate outcomes via direct DB/Redis access. No mocking of core services—integration testing preferred.

### Timer Testing

**NEVER use `setTimeout`/`sleep` in tests.** Instead, manipulate Redis TTL to fast-forward timers and rely on events.

**Use `TestUtils.expireTimer()` for all timer expiration testing:**

```typescript
// ✅ Correct: Use centralized utility
await testUtils.expireTimer(gameId, "bidding", 150);

// ❌ Wrong: Manual Redis manipulation
const redisClient = RedisConfig.getClient();
await redisClient.pexpire(`timer:${gameId}:bidding`, 50);
await new Promise((resolve) => setTimeout(resolve, 150));
```

### Test Timeouts

NEVER increase test timeouts - if a test times out, the issue is almost always a missing event, indicating broken code in test.

---

---
applyTo: "server/**/*"
---

# OpenQuester Backend Instructions

## Key Docs (Read First)
- **Final Round:** `server/docs/final-round-flow.md` - Theme elimination → bidding → answering → reviewing
- **Action Queue:** `server/docs/game-action-executor.md` - Race condition prevention via Redis locks
- **Media Sync:** `server/docs/media-download-sync.md` - Cross-client synchronization

## Architecture
**4 Layers:** `domain/` (pure logic, entities), `application/` (services), `infrastructure/` (DB, Redis, S3), `presentation/` (REST, Socket.IO)
**DI:** tokens in `server/src/shared/di/tokens.ts`; composition in `server/src/bootstrap/bootstrapContainer.ts`

## Core Patterns

### Socket Events
Socket.IO events are mapped in `server/src/presentation/controllers/io/SocketActionMap.ts`.
`SocketActionDispatcher` resolves Redis-backed socket/session context, validates payloads, builds a `GameAction`, and submits it to `GameActionExecutor`.

Do not implement the obsolete `BaseSocketEventHandler` / `SocketEventHandlerRegistry` architecture.

### Action Queue (Critical)
**Problem:** Concurrent socket events → corrupt state
**Solution:** `GameActionExecutor` + Redis lock per game
```typescript
await gameActionExecutor.submitAction({
  id,
  type: GameActionType.X,
  gameId,
  playerId,
  socketId,
  timestamp: new Date(),
  payload
});
```

### Game State
- Stored in Redis (serialized GameStateDTO)
- Retrieved: `SocketGameContextService.getFullGameContext()`
- Round progression: `RoundHandlerFactory`

### Multi-instance Safety
Production can run multiple independent Node.js server instances behind a load balancer. There is no sticky-session assumption: HTTP auth, Socket.IO events, timer notifications, and queued action processing may happen on different instances.

- Process-local state may own local lifecycle, local sockets, logger streams, metrics buffers, immutable config, and test-only harness state.
- Production game correctness may not depend on process-local `Map`, `Set`, array, promise chain, EventEmitter, mutex, or test helper state.
- Do not introduce local coordination for distributed game flows. Use Redis game state, Redis socket/session metadata, Redis action queues and locks, Redis timers, Socket.IO Redis adapter operations, and distributed Redis cron locks.
- A local cache requires a distributed source of truth or safe reconstruction after eviction/restart.
- Tests may use in-memory journals, actors, and scenario state under `server/tests`, but production code must not depend on test-only classes.
- When unsure whether state is local or distributed, document ownership before implementing it.

### Validation
REST: Joi + `RequestDataValidator` | Socket: validators declared in `SocketActionMap.ts` | Rules: `domain/validators/`

## Testing
```bash
npm test                # All tests
npm run test:pipeline   # CI
npx jest path/to/file   # Specific (set trace logs in tests/utils.ts)
```
**Timer Testing:** Use `TestUtils.expireTimer()` - NEVER `setTimeout` in tests
**NO test timeout increases** - missing events = broken code

## Conventions
**Naming:** Services end `Service`, Repositories end `Repository`; socket game actions are map entries plus use cases/handlers registered in the action system
**Enums:** `PascalCase` names, `SCREAMING_SNAKE_CASE` or `"kebab-case"` values
**DTOs:** `domain/types/dto/`, interfaces only, use mappers
**Errors:** `ClientError` (translated), `ServerError` (not translated)
**Redis:** Namespaced keys (e.g. `game:{gameId}`), `keyspace` notifications + handlers
**TypeORM:** Manual migrations (`infrastructure/database/migrations/`), snake_case via `SnakeNamingStrategy`

## Type Safety
- **NEVER** `any` → use `unknown` or `Record<string, T>`
- Explicit return types
- Use `satisfies` on un-typed objects
- **NEVER** re-exports or `index.ts` files

## Critical Files
- DI tokens: `server/src/shared/di/tokens.ts`
- DI composition: `server/src/bootstrap/bootstrapContainer.ts`
- Socket event mapping: `server/src/presentation/controllers/io/SocketActionMap.ts`
- Socket dispatch: `server/src/presentation/controllers/io/SocketActionDispatcher.ts`
- Game action execution: `server/src/application/executors/GameActionExecutor.ts`
- Distributed action docs: `server/docs/game-action-executor.md`
- Test bootstrap: `tests/TestApp.ts`
- Game state transitions: `server/src/domain/state-machine/`

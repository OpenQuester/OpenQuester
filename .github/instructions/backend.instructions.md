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
**DI:** Symbol-based registry in `application/Container.ts`

## Core Patterns

### Socket Events
Extend `BaseSocketEventHandler<TInput, TOutput>`: `validate()` → `execute()` → `broadcast()`
Auto-registered via `SocketEventHandlerRegistry`

### Action Queue (Critical)
**Problem:** Concurrent socket events → corrupt state
**Solution:** `GameActionExecutor` + Redis lock per game
```typescript
protected async executeAction(data: TInput): Promise<GameActionResult> {
  const action: GameAction = { id: uuidv4(), type: GameActionType.X, gameId, ...data };
  return this.actionExecutor.submitAction(action, async (action) => { /* logic */ });
}
```

### Game State
- Stored in Redis (serialized GameStateDTO)
- Retrieved: `SocketGameContextService.getFullGameContext()`
- Round progression: `RoundHandlerFactory`

### Validation
REST: Joi + `RequestDataValidator` | Socket: Joi in `validate()` | Rules: `domain/validators/`

## Testing
```bash
npm test                # All tests
npm run test:pipeline   # CI
npx jest path/to/file   # Specific (set trace logs in tests/utils.ts)
```
**Timer Testing:** Use `TestUtils.expireTimer()` - NEVER `setTimeout` in tests
**NO test timeout increases** - missing events = broken code

## Conventions
**Naming:** Services end `Service`, Repositories end `Repository`, Socket events `*EventHandler`
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
- DI: `application/Container.ts`
- Socket: `presentation/index.ts`
- Test bootstrap: `tests/TestApp.ts`
- Game orchestrator: `domain/orchestrators/GameOrchestrator.ts`

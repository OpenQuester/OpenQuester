# Redis Pipeline Optimization — ActionExecutionContext

Replaces the previous Lua/JSON optimization plan. The core idea: prefetch all needed data via a single Redis pipeline at the start of action execution, pass a rich context through handlers, and flush all mutations in a single pipeline at the end.

---

## Current Bottleneck Summary

Per-action cost for hot-path game actions (buzz, skip, pick):

```
Socket event handler:
  getGameIdForSocket()    → HGETALL socket:session  → 1 RT

GameActionExecutor:
  acquireLock()           → SET NX                  → 1 RT
  
Action handler:
  loadGameAndPlayer()     → HGETALL game:{id}       → 1 RT
                          → EXPIRE game:{id}        → 1 RT
  Business logic          → in-memory               → 0 RT
  updateGame()            → MULTI[HSET + EXPIRE]    → 1 RT
                          → EXPIRE game:package     → 1 RT
                          → SET expiration:warning   → 1 RT
  Timer ops               → SET/DEL timer           → 1-3 RTs

Post-execution:
  Broadcast (role-based)  → HGETALL game:{id} AGAIN → 1 RT  ← redundant
                          → batch socket sessions   → 1 RT
  releaseLock()           → DEL lock                → 1 RT
  processQueuedActions()  → LLEN queue              → 1 RT
                                                    ──────────
                                                     11-14 RTs
```

Under contention (10 players buzz simultaneously):
- 1 action executes (~14 RTs)
- 9 actions queue (9 RPUSH = 9 RTs)
- Queue drain: 9 cycles × (lock + load + execute + save + unlock) = ~99 RTs
- **Total: ~120+ Redis commands, ~10ms wall time on localhost**
- Each cycle re-parses and re-serializes the full game state
- Production logs show massive "Cannot process queue - lock held" warnings (see `lock-issues-under-load.md`)

### Identified Problems

1. **11-14 sequential Redis round-trips per action** — each awaited individually
2. **`updateGame()` is 3 sequential awaits** — `MULTI[HSET+EXPIRE]`, `EXPIRE package`, `SET warning` (`GameRepository.ts`)
3. **Broadcast re-fetches the game** — `SocketIOGameService.getGameStateBroadcastMap()` calls `getGameEntity(gameId)` right after the handler just saved it. 100% redundant HGETALL
4. **Queue drain re-acquires lock per item** — `processQueuedActions()` is recursive, each iteration: acquire lock → load game → execute → save → release lock
5. **Lock has no owner token** — `GameActionLockService` uses bare `DEL` to release. Any caller can release any lock. No compare-and-delete safety

---

## Plan Overview

| Phase | What | RTs/action | Effort | Risk |
|-------|------|-----------|--------|------|
| 0 | Redis upgrade + IO threads | Same (faster baseline) | Config only | None |
| 1 | Quick wins (pipeline, lock, broadcast fix) | ~7-8 | Low | Very low |
| 2 | ActionExecutionContext pipeline | **2** | Medium | Low |
| 3 | Batch queue drain | 2 (+ contention fix) | Low-Medium | Low |

Each phase is independently shippable and testable.

---

## Phase 0 — Redis Upgrade + IO Threads (config only)

Your `compose.yml` uses `bitnami/redis:8.0`. The latest is **Redis 8.6** which includes:
- 87% faster command latency on many commands (vs Redis 7.x)
- I/O threading: set `io-threads 4` for up to 2x throughput on multi-core
- Lookahead prefetching (8.4): parses multiple commands ahead, reducing latency
- Hash/sorted set internal optimizations (8.6)

```yaml
# compose.yml change
redis:
  image: bitnami/redis:8.6    # was 8.0
  environment:
    - REDIS_IO_THREADS=4       # enable multi-threaded I/O
```

**Effort**: Change 2 lines. **Impact**: Up to 2x throughput, lower baseline latency.

---

## Phase 1 — Quick Wins (no architecture change)

Three independent fixes that can be shipped in any order, no refactoring needed.

### 1A — `updateGame()` Pipeline Consolidation

**File**: `GameRepository.ts` — `updateGameWithIndexes()`

Currently 3 sequential awaits:

```typescript
// Current — 3 RTs
await this.redis.hset(gameKey, serialized, ttl);    // MULTI[HSET + EXPIRE] → 1 RT
await this.redis.expire(packageKey, ttl);            // EXPIRE → 1 RT
await this.redis.set(warningKey, "1", warningTtl);   // SET → 1 RT
```

Fix — 1 pipeline:

```typescript
const pipeline = this.redis.pipeline();
pipeline.hset(gameKey, serialized);
pipeline.expire(gameKey, ttl);
pipeline.expire(packageKey, ttl);
pipeline.set(warningKey, "1", "EX", warningTtl);
await pipeline.exec();  // 1 RT
```

**Effort**: ~30 min. **Impact**: 3 RTs → 1 RT per `updateGame()` call.

### 1B — Lock Owner Token Safety

**File**: `GameActionLockService.ts`

Current lock uses bare `SET NX` with value `"1"` and releases with `DEL`. Any caller can release any lock.

Fix — use a unique token and compare-and-delete:

```typescript
// Acquire
const token = crypto.randomUUID();
const acquired = await this.redis.set(lockKey, token, "EX", ttl, "NX");
// Return token on success

// Release — only if we still own it
const script = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  else
    return 0
  end
`;
await this.redis.eval(script, 1, lockKey, token);
```

This is the standard Redis distributed lock pattern (Redlock-lite). Prevents:
- Releasing a lock held by another instance after TTL expiry + re-acquire
- Race conditions in multi-instance deployments

**Effort**: ~1 hour. **Impact**: Correctness fix, prevents silent data corruption under edge cases.

### 1C — Eliminate Broadcast Game Re-fetch

**File**: `GameActionBroadcastService.ts`, `SocketIOGameService.ts`

The problem — after a handler executes and saves the game, the broadcast system re-fetches it:

```
Handler.execute()
  → loadGameAndPlayer()      → HGETALL game:{id}     ✓ needed
  → mutate game in memory
  → updateGame(game)          → HSET game:{id}        ✓ needed
  → return { broadcasts, ... }

Executor.emitBroadcasts()
  → emitWithRoleBasedFiltering()
    → getGameStateBroadcastMap()
      → getGameEntity(gameId)  → HGETALL game:{id}   ✗ REDUNDANT
```

Fix — pass the `Game` entity through the broadcast chain:

```typescript
// GameActionHandlerResult — add optional game field
interface GameActionHandlerResult {
  success: boolean;
  broadcasts?: BroadcastEvent[];
  broadcastGame?: Game;          // ← new: pass through for broadcasts
  // ...
}

// GameActionBroadcastService.emitBroadcasts() — accept game
async emitBroadcasts(broadcasts, defaultGameId, game?) { ... }

// SocketIOGameService.getGameStateBroadcastMap() — accept game
async getGameStateBroadcastMap(socketIds, gameId, gameState, game?) {
  // Use provided game instead of re-fetching
  const g = game ?? await this.gameService.getGameEntity(gameId);
  ...
}
```

**Effort**: ~2 hours. **Impact**: Eliminates 1 redundant HGETALL per action with role-based broadcasts.

### Phase 1 Cumulative Impact

| Metric | Before | After Phase 1 |
|--------|--------|---------------|
| RTs per action (typical) | 11-14 | **~7-8** |
| `updateGame()` RTs | 3 | **1** |
| Broadcast re-fetch | 1 HGETALL | **0** |
| Lock safety | No owner check | **Compare-and-delete** |

---

## Phase 2 — ActionExecutionContext Pipeline

The core optimization. Restructure the execution flow to fetch all data in a single pipeline at the start and flush all mutations in a single pipeline at the end.

### Current Flow (sequential)

```
acquireLock()             → 1 RT
loadGameAndPlayer()       → 1-2 RT
  ... handler logic ...
updateGame()              → 1 RT  (after Phase 1A)
timer ops                 → 1-3 RT
releaseLock()             → 1 RT
checkQueue()              → 1 RT
                          ─────────
                           6-9 RTs
```

### Target Flow (2 pipelines)

```
┌─ IN Pipeline (1 RT) ─────────────────────────┐
│  SET game:action:lock:{gameId} token EX 10 NX │
│  HGETALL game:{gameId}                        │
│  EXPIRE game:{gameId} TTL                     │
│  GET timer:{gameId}                           │
└───────────────────────────────────────────────┘
       ↓ parse results
       ↓ if lock not acquired → RPUSH to queue (1 RT), done
       ↓ if lock acquired → build ActionExecutionContext
       
  ... handler logic (pure in-memory) ...
  ... handler returns mutations ...
  
┌─ OUT Pipeline (1 RT) ────────────────────────────────┐
│  HSET game:{gameId} ...mutated fields...             │
│  EXPIRE game:{gameId} TTL                            │
│  EXPIRE game:package:{gameId} TTL                    │
│  SET game:expiration:warning:{gameId} "1" EX warnTTL │
│  SET/DEL timer:{gameId} (if changed)                 │
│  EVAL compare-and-delete lock                        │
│  LLEN game:action:queue:{gameId}                     │
└──────────────────────────────────────────────────────┘
       ↓ if queueLen > 0 → process queued actions
       
Total: 2 RTs (success path)
       2 RTs (lock failure: wasted HGETALL in pipeline + RPUSH)
```

Note on lock-in-pipeline safety: Redis executes pipeline commands sequentially without interleaving from other clients (single-threaded). If SET NX fails, the HGETALL still executes (wasted read), but we discard the result. Lock semantics are preserved.

### 2A — ActionExecutionContext Type

```typescript
/**
 * Rich context created at the start of action execution.
 * Contains all prefetched data needed by handlers.
 * Handlers read from context instead of making Redis calls.
 */
interface ActionExecutionContext {
  // Identity
  gameId: string;
  playerId: number;
  socketId: string;
  action: GameAction;

  // Prefetched data (loaded in IN pipeline)
  game: Game;
  currentPlayer: Player | null;
  timer: GameStateTimerDTO | null;

  // Lock
  lockToken: string;
}

/**
 * Result returned by handlers. Contains mutations to flush.
 */
interface ActionExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;

  // Mutations (flushed in OUT pipeline)
  gameDirty: boolean;           // whether game needs saving
  timerUpdate?: TimerMutation;  // SET, DEL, or null (no change)
  broadcasts: BroadcastEvent[];
  broadcastGame?: Game;         // pass-through for broadcast (Phase 1C)
}

type TimerMutation =
  | { action: "set"; key: string; value: string; ttl: number }
  | { action: "delete"; key: string }
  | null;
```

### 2B — GameActionExecutor Refactor

The executor becomes responsible for the IN/OUT pipelines:

```typescript
class GameActionExecutor {

  async submitAction(action: GameAction): Promise<GameActionResult> {
    const lockToken = crypto.randomUUID();

    // ── IN Pipeline ──
    const inResults = await this.executePipelineIn(action, lockToken);

    if (!inResults.lockAcquired) {
      await this.queueService.pushAction(action);
      return { success: true }; // queued
    }

    try {
      // Build context from pipeline results
      const ctx = this.buildContext(action, inResults, lockToken);

      // Execute handler (pure logic, no Redis calls)
      const handler = this.handlerRegistry.get(action.type)!;
      const result = await handler.execute(action, ctx);

      // ── OUT Pipeline ──
      await this.executePipelineOut(ctx, result);

      // Emit broadcasts (after pipeline, using in-memory game)
      if (result.success && result.broadcasts?.length) {
        await this.broadcastService.emitBroadcasts(
          result.broadcasts,
          action.gameId,
          result.broadcastGame ?? ctx.game
        );
      }

      // Process queue if needed
      if (inResults.queueLength > 0 || result.gameDirty) {
        await this.processQueuedActions(action.gameId);
      }

      return { success: result.success, data: result.data, error: result.error };
    } catch (error) {
      // Release lock on error
      await this.lockService.releaseLock(action.gameId, lockToken);
      throw error;
    }
  }

  private async executePipelineIn(action: GameAction, lockToken: string) {
    const pipeline = this.redis.pipeline();
    
    const lockKey = `game:action:lock:${action.gameId}`;
    const gameKey = `game:${action.gameId}`;
    const timerKey = `timer:${action.gameId}`;

    pipeline.set(lockKey, lockToken, "EX", LOCK_TTL, "NX");  // [0]
    pipeline.hgetall(gameKey);                                 // [1]
    pipeline.expire(gameKey, GAME_TTL);                        // [2]
    pipeline.get(timerKey);                                    // [3]

    const results = await pipeline.exec();

    return {
      lockAcquired: results[0][1] === "OK",
      gameHash: results[1][1] as Record<string, string>,
      timerRaw: results[3][1] as string | null,
    };
  }

  private async executePipelineOut(
    ctx: ActionExecutionContext,
    result: ActionExecutionResult
  ) {
    const pipeline = this.redis.pipeline();

    const gameKey = `game:${ctx.gameId}`;
    const packageKey = `game:package:${ctx.gameId}`;
    const warningKey = `game:expiration:warning:${ctx.gameId}`;
    const lockKey = `game:action:lock:${ctx.gameId}`;
    const queueKey = `game:action:queue:${ctx.gameId}`;

    // Save game (if mutated)
    if (result.gameDirty) {
      const serialized = GameMapper.serializeGameToHash(ctx.game);
      pipeline.hset(gameKey, serialized);
      pipeline.expire(gameKey, GAME_TTL);
      pipeline.expire(packageKey, GAME_TTL);
      pipeline.set(warningKey, "1", "EX", WARNING_TTL);
    }

    // Timer mutation
    if (result.timerUpdate?.action === "set") {
      pipeline.set(result.timerUpdate.key, result.timerUpdate.value, "EX", result.timerUpdate.ttl);
    } else if (result.timerUpdate?.action === "delete") {
      pipeline.del(result.timerUpdate.key);
    }

    // Release lock (compare-and-delete)
    pipeline.eval(COMPARE_AND_DELETE_SCRIPT, 1, lockKey, ctx.lockToken);

    // Check queue
    pipeline.llen(queueKey);

    await pipeline.exec();
  }
}
```

### 2C — Handler Migration

Handlers change from "fetch data + call services + call updateGame" to "receive context + return mutations":

**Before** (current `QuestionAnswerActionHandler` → `SocketIOQuestionService.handleQuestionAnswer()`):

```typescript
async handleQuestionAnswer(ctx: ActionContext) {
  // Redis call 1: HGETALL game
  const { game, currentPlayer } =
    await this.socketGameContextService.loadGameAndPlayer(ctx);

  QuestionAnswerRequestLogic.validate(game, currentPlayer);

  // Redis call 2: SET timer (save elapsed)
  await this.socketGameTimerService.saveElapsedTimer(game, ...);

  // Phase transition (in-memory)
  const transitionResult = await this.phaseTransitionRouter.tryTransition({ game, ... });

  // Redis call 3-5: updateGame() → HSET + EXPIRE + SET
  await this.gameService.updateGame(game);

  return QuestionAnswerRequestLogic.buildResult({ game, playerId, timer });
}
```

**After**:

```typescript
async handleQuestionAnswer(
  action: GameAction,
  ctx: ActionExecutionContext
): Promise<ActionExecutionResult> {
  // No Redis calls — game and player already in context
  const { game, currentPlayer } = ctx;

  QuestionAnswerRequestLogic.validate(game, currentPlayer);

  // Timer save → return as mutation instead of Redis call
  const timerMutation = this.socketGameTimerService.buildSaveElapsedTimer(game, ...);

  // Phase transition (in-memory, same as before)
  const transitionResult = await this.phaseTransitionRouter.tryTransition({ game, ... });

  // No updateGame() call — return mutations instead
  return {
    success: true,
    data: QuestionAnswerRequestLogic.buildResult({ game, playerId, timer }),
    gameDirty: true,
    timerUpdate: timerMutation,
    broadcasts: transitionResult.broadcasts,
    broadcastGame: game,
  };
}
```

### 2D — Migration Strategy

Not all handlers need to be migrated at once. The executor can support both patterns during migration:

```typescript
// Executor checks if handler supports new interface
if (handler.supportsContext?.()) {
  // New path: pass context, collect mutations, pipeline out
  const result = await handler.executeWithContext(action, ctx);
  await this.executePipelineOut(ctx, result);
} else {
  // Legacy path: handler makes its own Redis calls (same as today)
  const result = await handler.execute(action);
  // Still need to release lock manually
  await this.lockService.releaseLock(action.gameId, lockToken);
}
```

**Migration order** (hot-path first):
1. `QuestionAnswerActionHandler` (buzz) — highest contention
2. `QuestionSkipActionHandler` (skip) — high frequency
3. `QuestionPickActionHandler` (pick) — high frequency
4. `AnswerSubmittedActionHandler` — already read-only, easiest migration
5. `PlayerReadyActionHandler` — simple
6. `AnswerResultActionHandler` — moderate complexity
7. Remaining handlers — lower priority, can stay on legacy path longer

### 2E — Services That Need Refactoring

Services currently make Redis calls that should instead return mutations:

| Service | Current | After |
|---------|---------|-------|
| `GameService.updateGame()` | Calls Redis HSET + EXPIRE | Returns `gameDirty: true` (caller is executor) |
| `SocketGameTimerService.saveElapsedTimer()` | Calls Redis SET | Returns `TimerMutation` |
| `SocketGameTimerService.clearTimer()` | Calls Redis DEL | Returns `TimerMutation` |
| `SocketGameContextService.loadGameAndPlayer()` | Calls Redis HGETALL | Reads from `ctx.game` |
| `GameService.clearTimer()` | Calls Redis DEL | Returns `TimerMutation` |

Services that do NOT need changes (separate from action pipeline):
- `PackageStore` — read-only, already optimized with HMGET
- `SocketUserDataService` — socket session management, separate lifecycle
- `PlayerGameStatsService` — statistics, fire-and-forget, separate lifecycle

### Phase 2 Impact

| Metric | Before (Phase 1) | After Phase 2 |
|--------|-------------------|---------------|
| RTs per action (success) | ~7-8 | **2** |
| RTs per action (lock fail) | 2 | **2** |
| Node.js awaits per action | 7-8 | **2** |
| JSON.parse per action | 1 | 1 (same, from HGETALL) |
| JSON.stringify per action | 1 | 1 (same, for HSET) |

---

## Phase 3 — Batch Queue Drain

### Problem

`processQueuedActions()` in `GameActionExecutor.ts:153` is recursive and reacquires the lock per item:

```
pop item → acquire lock → load game → execute → save → release lock → recurse
```

For N queued items: N lock cycles, N full game loads, N full game saves.

This is the root cause of the `lock-issues-under-load.md` warnings — the production logs show 80+ "Cannot process queue - lock held" per second during peak load.

### Fix

Lock once, pop all, execute sequentially, save once, unlock once:

```
acquire lock → load game → pop all from queue →
  execute item 1 (in-memory mutation) →
  execute item 2 (in-memory mutation) →
  ... →
save game → release lock
```

### Implementation

```typescript
private async processQueuedActions(gameId: string): Promise<void> {
  // Pop all queued actions in one batch
  const actions = await this.queueService.popAll(gameId);
  if (actions.length === 0) return;

  // IN pipeline: lock + load
  const lockToken = crypto.randomUUID();
  const inResults = await this.executePipelineIn({ gameId }, lockToken);

  if (!inResults.lockAcquired) {
    // Re-queue all actions (another instance is processing)
    await this.queueService.pushActions(gameId, actions);
    return;
  }

  try {
    let ctx = this.buildContext(actions[0], inResults, lockToken);
    const allBroadcasts: BroadcastEvent[] = [];

    for (const action of actions) {
      const handler = this.handlerRegistry.get(action.type);
      if (!handler) continue;

      // Update context identity for each action
      ctx = { ...ctx, playerId: action.playerId, socketId: action.socketId, action };

      try {
        const result = await handler.executeWithContext(action, ctx);

        if (result.gameDirty) {
          // Game was mutated — context.game is already updated in-memory
          // Don't save yet, accumulate
        }

        if (result.broadcasts?.length) {
          allBroadcasts.push(...result.broadcasts);
        }
      } catch (error) {
        // Log and continue with next action
        // Emit error to the specific socket that submitted this action
        this.broadcastService.emitError(action.socketId, resolveErrorMessage(error));
      }
    }

    // Single OUT pipeline for all accumulated mutations
    await this.executePipelineOut(ctx, {
      gameDirty: true,
      broadcasts: [],
      timerUpdate: ctx.lastTimerMutation,
    });

    // Emit all accumulated broadcasts in order
    for (const broadcast of allBroadcasts) {
      await this.broadcastService.emitBroadcast(broadcast, gameId, ctx.game);
    }
  } finally {
    await this.lockService.releaseLock(gameId, lockToken);

    // Check if more actions arrived during processing
    const remaining = await this.queueService.getQueueLength(gameId);
    if (remaining > 0) {
      await this.processQueuedActions(gameId);
    }
  }
}
```

### QueueService.popAll()

New method to atomically pop all items:

```typescript
async popAll(gameId: string): Promise<GameAction[]> {
  const key = this.getQueueKey(gameId);
  const items = await this.redis.lrange(key, 0, -1);
  if (items.length > 0) {
    await this.redis.del(key);
  }
  return items.map(item => JSON.parse(item));
}
```

Note: `LRANGE + DEL` is not atomic. Another item could be pushed between them. This is acceptable — the next `processQueuedActions` call will pick it up. For strict atomicity, use a Lua script:

```lua
local items = redis.call('LRANGE', KEYS[1], 0, -1)
redis.call('DEL', KEYS[1])
return items
```

### Broadcast Timing Consideration

Currently broadcasts emit between actions (each action's broadcasts fire before the next action executes). With batching, all broadcasts fire after all mutations complete.

For a quiz game this delay (a few ms at most) is imperceptible. The broadcast order is preserved — they're accumulated in FIFO order and emitted sequentially.

If strict inter-action broadcast ordering is required for a specific action type, that handler can opt out of batching by setting a flag.

### Phase 3 Impact

| Contention scenario | Before | After Phase 3 |
|--------------------|--------|---------------|
| 10 concurrent buzzes | ~120 Redis ops, ~10ms | **~20 ops, ~2ms** |
| 20 rapid events | ~240 Redis ops | **~25 ops** |
| Lock contention warnings | 80+/sec at peak | **Near zero** |
| Queue drain: N items | N × (lock + load + save + unlock) | **1 × (lock + load + save + unlock)** |

---

## Projected Cumulative Impact

| Metric | Current | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|--------|---------|---------|---------|---------|---------|
| RTs per action | 11-14 | 11-14 (faster) | ~7-8 | **2** | **2** |
| Burst 10 buzzes (wall) | ~10ms | ~6ms | ~5ms | ~3ms | **~1.5ms** |
| Lock contention warnings | 80+/sec | 80+/sec | 80+/sec | 80+/sec | **~0** |
| `updateGame()` RTs | 3 | 3 | **1** | N/A (part of OUT pipeline) | N/A |
| Broadcast re-fetch | 1 HGETALL | 1 HGETALL | **0** | **0** | **0** |
| Validation duplication | No | No | No | **No** | **No** |
| Max sustainable RPS (est.) | ~40 | ~80 | ~120 | ~500 | **~1000+** |

---

## Key Design Decisions

### Why not Lua scripts?

Lua scripts can reduce to 1 RT but introduce **validation duplication** — every business rule validated in TypeScript must be replicated in Lua and kept in sync. This is a significant maintenance burden for a codebase with 30+ action types and complex game state transitions. The 2-RT pipeline approach achieves 80% of the benefit without this cost.

### Why not Redis JSON?

Redis JSON (partial reads/writes via JSONPath) would reduce payload size from ~5-15KB to ~200B per action. However:
- Requires migrating `GameMapper`, `GameRepository`, `GameRedisValidator`, and all tests
- The current bottleneck is **round-trip count**, not payload size (5-15KB is fast over localhost/loopback)
- Pipeline consolidation (2 RTs) solves the latency problem without a storage format migration

If payload size becomes a bottleneck at higher scale, Redis JSON can be added as a future optimization on top of the pipeline approach.

### Lock in pipeline — is it safe?

Yes. Redis executes pipeline commands sequentially without interleaving from other clients (single-threaded execution model). The sequence `SET NX → HGETALL` in a pipeline is equivalent to two individual commands — if SET NX fails, we discard the HGETALL result. The only cost is one wasted HGETALL on lock contention, which is acceptable because:
- Lock contention is the minority case
- The HGETALL data would have been needed if the lock succeeded
- After Phase 3 (batch drain), lock contention drops to near-zero

### What about early exits?

Some handlers validate and exit early (e.g., player not eligible to answer). With the pipeline approach, the game was already loaded from Redis. This is wasted work, but:
- Validation failures are the exception, not the rule
- The HGETALL was part of the IN pipeline — no extra round trip
- The OUT pipeline simply skips HSET (gameDirty = false) and still releases the lock
- Net cost of an early exit: 2 RTs instead of the current 3-4 RTs (lock + load + unlock + queue check)

### Services that make Redis calls outside the action pipeline

Some services (PackageStore, PlayerGameStatsService, SocketUserDataService) make Redis calls that are NOT part of the game state pipeline. These are left as-is because:
- **PackageStore**: Read-only, already uses HMGET batching. Accessed by ~3 handlers (question pick, force skip, answer result). Doesn't need to be in the pipeline because it's a different key with different access patterns.
- **PlayerGameStatsService**: Fire-and-forget statistics updates. Runs after action completion, doesn't block the response.
- **SocketUserDataService**: Socket session management. Only called during join/leave/disconnect — low-frequency actions not on the hot path.

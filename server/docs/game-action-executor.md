# GameActionExecutor (server)

GameActionExecutor makes game state updates safe.
It guarantees: for a given `gameId`, actions run **one at a time**, in order.

It does this with:

- a **Redis lock** (so only one action can execute)
- a **Redis queue** (so actions that arrive while locked are not lost)
- an **IN pipeline / Lua drain prefetch** (game, timer, and socket session are loaded before handler execution)
- an **OUT mutation processor** (handlers declare game/timer/socket/broadcast side effects instead of performing hidden writes)

---

## Quick lookup (jump table)

| Topic                       | Link                                                   |
| --------------------------- | ------------------------------------------------------ |
| Entry point                 | [`submitAction`](#submitaction-entry-point)            |
| How lock + queue works      | [`How it works`](#how-it-works-lock--queue--drain)     |
| Redis keys and data         | [`Redis keys`](#redis-keys-and-what-they-store)        |
| Fairness / no double clicks | [`Fairness`](#fairness-why-concurrent-clicks-are-safe) |
| Common queued actions       | [`Common scenarios`](#common-queued-action-scenarios)  |
| Minimal code example        | [`Example`](#minimal-example)                          |
| Relevant files              | [`Relevant files`](#relevant-files)                    |

---

## `submitAction` entry point

Call `submitAction(action)`.

Every game-changing action is pushed to the game queue first. The submitter then tries to become the queue processor. If it cannot acquire the lock, it returns successfully and the current processor will drain the queued action later.

`GameAction` is a plain object like:

- `id`: unique id
- `type`: action type (example: `join`, `leave`, `answer-submitted`)
- `gameId`: which game to lock/queue
- `socketId`: used to send error to the origin socket (if needed)
- `timestamp`: when action was created
- `payload`: action-specific data

## How it works (lock → queue → drain)

For each `gameId`:

1. Push the action to the Redis list queue.
2. Try to acquire the Redis lock with an owner token.
3. If lock is busy, return; another processor is already draining.
4. If lock is acquired, drain the queue:
   - atomically verify lock ownership, pop the next action, reacquire the lock with a new token, and prefetch game/timer/socket session
   - execute the action handler with prefetched context
   - process declared mutations (Redis save/delete/timer operations, socket-session updates, stats, disconnects, completions, broadcasts)
   - run post-execution socket hooks
   - repeat until the queue is empty, then release the lock

So it’s basically: **one FIFO list + one token-owned lock per game**, with one processor draining the queue in order.

## Redis keys and what they store

### Lock key

- Key: `game:action:lock:{gameId}`
- Value: UUID owner token
- TTL: 10 seconds by default

Lock acquire is atomic in Redis (one command):

```text
SET game:action:lock:{gameId} {token} EX 10 NX
```

Meaning:

- `NX`: only set if it doesn’t exist (so only one processor wins)
- `EX 10`: auto-expire to avoid deadlocks if a server crashes
- release uses compare-and-delete Lua, so only the current token owner can release the lock

### Queue key

- Key: `game:action:queue:{gameId}`
- Type: Redis list
- Push: `RPUSH` (to tail)
- Pop: `LPOP` (from head)

Each list item is JSON.
Important detail: `payload` is stored as a JSON _string_ inside the object.

Example queued item (what’s inside the Redis list):

```json
{
  "id": "7b1c2f2a-9b2c-4c18-9b2c-2df2c9a3f111",
  "type": "leave",
  "gameId": "game-123",
  "playerId": 9,
  "socketId": "socket-abc",
  "timestamp": "2025-12-19T12:34:56.789Z",
  "payload": "{\"reason\":\"disconnect\"}"
}
```

## Fairness (why concurrent clicks are safe)

When multiple players do something at the same time (example: two people click “answer” together),
the server still processes it as a strict sequence:

- one action gets the lock and runs
- the other action(s) get queued
- then the queue is drained in FIFO order

So there is no “two actions modifying state at once”.
That’s what prevents race conditions like double-scoring, double-advancing, etc.

Note: the system guarantees **no overlap**, not a magical “perfect fairness” in network timing.
Order is basically “who reached Redis first”.

Important implementation detail: queued actions are not a weaker path. The drain script prefetches game state, active timer, and socket session for each queued action, then the normal handler + `DataMutationProcessor` path runs. That keeps queued behavior aligned with immediately processed behavior for broadcasts, timer mutations, game deletion, and socket-session updates.

## Common queued action scenarios

- Rapid `join` / `leave` / `disconnect` spikes (mobile network reconnects are common)
- Back-to-back `answer-submitted` clicks (spam or double tap)
- A timer-expired action arriving while a player action is still running
- Multiple `question-skip` / `answer-result` actions arriving together during an active question

This is exactly why queuing exists: you can accept bursts safely and process them later.

Example of what a queue might look like during a reconnect storm:

```text
RPUSH game:action:queue:game-123 {"type":"leave","playerId":"p1",...}
RPUSH game:action:queue:game-123 {"type":"join","playerId":"p1",...}
RPUSH game:action:queue:game-123 {"type":"leave","playerId":"p2",...}

LPOP  game:action:queue:game-123 -> leave(p1)
LPOP  game:action:queue:game-123 -> join(p1)
LPOP  game:action:queue:game-123 -> leave(p2)
```

## Minimal example

```ts
await actionExecutor.submitAction({
  id: "uuid",
  type: "leave",
  gameId: "game-123",
  playerId: 9,
  socketId: "socket-abc",
  timestamp: new Date(),
  payload: { reason: "disconnect" },
});
```

Under the hood, the executor executes actions via a registered handler.
Handlers are stateless and registered by `GameActionType` in `GameActionHandlerRegistry`.

Handlers return `DataMutation[]`; the processor applies them in a fixed order:

1. Redis game save/delete and timer mutations
2. Socket session updates
3. Player statistics updates
4. Forced socket disconnects
5. Game completion side effects
6. Socket broadcasts

`DELETE_GAME` mutations remove Redis game/package/timer/queue keys and lobby indexes in the same pipeline.

## Relevant files

- `server/src/application/executors/GameActionExecutor.ts`
- `server/src/application/executors/DataMutationProcessor.ts`
- `server/src/application/config/ActionHandlerConfig.ts` (where handlers are registered)
- `server/src/application/services/pipeline/GamePipelineService.ts`
- `server/src/application/services/lock/GameActionLockService.ts`
- `server/src/application/services/queue/GameActionQueueService.ts`
- `server/src/infrastructure/database/repositories/RedisRepository.ts` (lock uses `SET ... NX EX`)

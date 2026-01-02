---
title: Game Action Executor
weight: 10
---

# GameActionExecutor (server)

GameActionExecutor makes game state updates safe.
It guarantees: for a given `gameId`, actions run **one at a time**, in order.

It does this with:

- a **Redis lock** (so only one action can execute)
- a **Redis queue** (so actions that arrive while locked are not lost)

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

If the game is **not locked**, the action executes immediately.
If the game **is locked**, the action is pushed to the Redis queue and will run later.

`GameAction` is a plain object like:

- `id`: unique id
- `type`: action type (example: `join`, `leave`, `answer-submitted`)
- `gameId`: which game to lock/queue
- `socketId`: used to send error to the origin socket (if needed)
- `timestamp`: when action was created
- `payload`: action-specific data

## How it works (lock → queue → drain)

For each `gameId`:

1. Try to acquire Redis lock.
2. If lock is busy:
   - push the action into the Redis list queue
   - return (action will run later)
3. If lock is acquired:
   - execute the action
   - release the lock
   - drain the queue (pop next action, run it, repeat)

So it’s basically: **one lock + one FIFO list per game**.

## Redis keys and what they store

### Lock key

- Key: `game:action:lock:{gameId}`
- Value: string `"1"`
- TTL: 10 seconds by default

Lock acquire is atomic in Redis (one command):

```text
SET game:action:lock:{gameId} 1 EX 10 NX
```

Meaning:

- `NX`: only set if it doesn’t exist (so only one “winner”)
- `EX 10`: auto-expire to avoid deadlocks if a server crashes

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
  "playerId": "player-9",
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

## Common queued action scenarios

- Rapid `join` / `leave` / `disconnect` spikes (mobile network reconnects are common)
- Back-to-back `answer-submitted` clicks (spam or double tap)
- A timer-expired action arriving while a player action is still running

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
  playerId: "player-9",
  socketId: "socket-abc",
  timestamp: new Date(),
  payload: { reason: "disconnect" },
});
```

Under the hood, the executor executes actions via a registered handler.
Handlers are stateless and registered by `GameActionType` in `GameActionHandlerRegistry`.

## Relevant files

- `server/src/application/executors/GameActionExecutor.ts`
- `server/src/application/config/ActionHandlerConfig.ts` (where handlers are registered)
- `server/src/infrastructure/services/lock/GameActionLockService.ts`
- `server/src/infrastructure/services/queue/GameActionQueueService.ts`
- `server/src/infrastructure/database/repositories/RedisRepository.ts` (lock uses `SET ... NX EX`)

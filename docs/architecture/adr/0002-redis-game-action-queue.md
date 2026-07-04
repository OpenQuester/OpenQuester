# ADR 0002 — Redis-backed game action queue

Status: Accepted

## Context

OpenQuester game state is realtime and mutable. Multiple socket events can arrive almost simultaneously: answer presses, skips, disconnects, timer expirations, joins/leaves, and showman decisions.

If two actions mutate the same game at once, state can corrupt through double scoring, double phase transition, lost timer updates, or inconsistent broadcasts.

## Decision

For game-changing actions, use `GameActionExecutor` with a Redis queue and per-game lock.

Core flow:

```text
action arrives
  -> push to Redis queue for gameId
  -> try to acquire Redis lock
  -> one processor drains FIFO queue
  -> each action executes handler with prefetched context
  -> DataMutationProcessor applies declared side effects
  -> broadcasts/hooks run after mutations
```

This gives one-at-a-time execution per `gameId` and preserves FIFO order according to Redis arrival order.

## Consequences

Good:

- Prevents overlapping game state mutations.
- Handles bursts from rapid clicks, reconnect storms, and timer/player races.
- Keeps queued and immediately processed actions on the same handler/mutation path.
- Makes race-sensitive behavior easier to test.

Trade-offs:

- It guarantees serialized processing, not perfect real-world latency fairness. “First” means the action that reaches Redis first.
- Handlers must remain stateless/distributed-safe.
- Long-running handlers risk lock TTL/reacquire issues and should be avoided.

## Agent rules

- Game-changing Socket.IO events must use `GameActionExecutor.submitAction(...)`.
- Do not set `directExecution: true` for actions that mutate game state.
- Do not write Redis game state directly from presentation.
- Use `DataMutation[]` for side effects.
- Add queue-sensitive tests when behavior depends on simultaneous actions.
- Read `server/docs/game-action-executor.md` before modifying executor/lock/queue behavior.

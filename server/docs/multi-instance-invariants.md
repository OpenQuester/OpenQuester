# Multi-Instance Server Invariants

OpenQuester production may run multiple independent Node.js server processes behind a load balancer. Do not assume sticky sessions: an HTTP auth request, the next Socket.IO event, a timer expiration, and the action processor may all run on different instances.

Process memory may own resources local to one server instance, but it must not be the source of truth for behavior that must remain correct across instances or after a process restart.

## Runtime Model

Each instance owns its heap, DI container, HTTP server, Socket.IO server, local socket objects, logger, metrics buffers, lifecycle state, and background-service objects.

Instances share PostgreSQL, Redis, Redis-backed live game state, Redis-backed socket/session metadata, Redis action queues and locks, Redis timers, and Socket.IO Redis adapter communication.

If one instance stops or crashes, authoritative game-flow state must remain recoverable from shared storage. Losing local objects may disconnect that instance's sockets or lose local diagnostics, but must not lose current game state, pending actions, timers, scores, readiness, restrictions, or completion decisions.

## Authoritative Storage

| Data category | Authoritative storage |
| --- | --- |
| Durable relational data, users, packages, permissions, statistics | PostgreSQL |
| Live game state, current phase, current question, scores, player readiness, media-download readiness | Redis game state |
| Socket authentication, player socket metadata, mute context | Redis socket/session metadata |
| Game-changing action ordering and pending work | Redis queue plus token-owned Redis lock |
| Timers and timeout completion | Redis timer keys plus queued timer actions |
| Cross-instance room broadcasts and socket operations | Socket.IO Redis adapter |
| Cron ownership | Distributed Redis lock per cron job |
| Local lifecycle, logger, metrics buffers, diagnostics | Current process memory only |

## Allowed Process-Local State

Process-local state is valid when it owns only local resources or is a correctness-neutral cache:

- `ServeApi` lifecycle state, cached init/shutdown promises, and references to this process' HTTP server, Socket.IO server, and initialized services.
- Local socket objects and local socket context, when Redis session data remains the authoritative fallback.
- Logger streams, metrics buffers, health probes, and diagnostics labelled as local.
- Immutable startup configuration.
- Test-only `ServerTestHarness`, event journals, actors, and scenario state under `server/tests`.
- Caches whose eviction or loss cannot change game correctness.

Do not coordinate process startup or shutdown through Redis. Each instance starts and stops its own resources.

Startup readiness is process-local. An instance may bind its HTTP port before
shared startup preparation completes, but it must not serve application HTTP
routes or admit Socket.IO connections until its own lifecycle state is ready.
Readiness must not be stored in Redis or inferred from cluster-wide sockets.

Good:

```ts
private shutdownPromise: Promise<void> | undefined;

public shutdown(): Promise<void> {
  this.shutdownPromise ??= this.shutdownThisProcess();
  return this.shutdownPromise;
}
```

Bad:

```ts
// Incorrect: this blocks independent instances from managing their own lifecycle.
await redis.set("server:startup-lock", process.pid, "NX");
```

## Forbidden Process-Local Correctness State

Production code must not use a local `Map`, `Set`, array, promise chain, event emitter, mutex, or object as the only source of truth for:

- game state, current phase, current question, current turn, round progression, or scores;
- player role, readiness, media-download readiness, restrictions, or membership;
- authenticated socket session data required to process an action;
- action ordering, pending actions, locks, deduplication, idempotency, or processed action IDs;
- timer ownership, timeout completion, or "all players completed" barriers;
- whether an event was already emitted;
- global online player/socket counts or cross-instance room membership;
- cron ownership;
- recovery state required after process restart.

Bad:

```ts
private readonly games = new Map<string, Game>();
private readonly handledActions = new Set<string>();
private readonly activeTimers = new Map<string, NodeJS.Timeout>();
```

These are valid in tests or explicitly local diagnostics, but not as production correctness state.

## Socket.IO Rules

Use adapter-aware APIs for cluster-wide behavior:

```ts
namespace.to(gameId).emit(event, payload);
await namespace.in(gameId).fetchSockets();
namespace.in(socketId).socketsJoin(gameId);
namespace.in(socketId).socketsLeave(gameId);
namespace.in(socketId).disconnectSockets(true);
namespace.serverSideEmit("runtime-context-update", update);
```

`namespace.sockets` is local to one process. It may be used only to apply an update to a socket known to be local, collect local shutdown diagnostics, or expose local metrics. It must not decide whether a player is globally online, whether a room is empty, whether a game should be deleted, whether readiness is complete, or whether to emit or suppress a gameplay event.

Good:

```ts
this.namespace.serverSideEmit(SOCKET_RUNTIME_CONTEXT_UPDATE_EVENT, update);
const socket = this.namespace.sockets.get(update.socketId);
if (socket) {
  socket.userId = update.userId;
}
```

Bad:

```ts
if (this.namespace.sockets.size === 0) {
  await deleteGame(gameId);
}
```

## Game Actions And Locks

Every game-changing action must enter the Redis-backed action queue. Ordering and mutual exclusion are controlled by Redis, not by a process-local promise chain, mutex, `Map`, or `Set`.

`GameActionExecutor.submitAction()` queues the action and lets the instance that owns the token-held Redis lock drain the queue. The instance that received the socket event may not be the instance that executes the action.

Direct execution is allowed only for actions that never mutate game state and never require timer, lock, queue, or completion mutations.

Good:

```ts
await actionExecutor.submitAction({
  id,
  type: GameActionType.PLAYER_READY,
  gameId,
  playerId,
  socketId,
  timestamp: new Date(),
  payload
});
```

Bad:

```ts
private readonly processingGames = new Set<string>();

if (this.processingGames.has(gameId)) {
  return;
}
this.processingGames.add(gameId);
```

## Timers And Cron

Timers are Redis keys. Timer expiration handlers must be idempotent because multiple instances may observe duplicate Redis keyspace notifications. Expiration handling must enqueue a game action instead of mutating game state directly.

Cron jobs may be scheduled locally on every instance, but execution must use a distributed Redis lock for ownership. Stopping one instance stops only its local scheduled tasks and must not release or delete another instance's ownership state.

## Shutdown Boundaries

Shutdown closes only resources owned by the current process:

- local cron scheduled tasks;
- local Redis pub/sub subscription;
- local metrics collection;
- local Socket.IO server and its local sockets;
- local HTTP server;
- root Redis clients created by this process;
- local DI container instances and logger.

Shutdown must not delete active games, clear game action queues, clear game timers, invalidate sockets connected to other instances, unsubscribe another instance, or wait for global queues to become empty.

HTTP listen failure must not run shared startup preparation, start distributed subscribers, start cron jobs, or mutate shared game state. Bind the local HTTP server before starting those steps.

Ordinary replicated-instance startup must not clear active Redis games, timers,
socket sessions, or user-to-socket lookup keys. `STARTUP_RECOVERY_ENABLED=true`
means destructive cluster-wide cold-start recovery: the operator guarantees that
no other server instance is serving active games or sockets. The existing
distributed recovery locks prevent duplicate execution; they do not make this
mode safe while another live instance is serving traffic.

## Review Checklist

- Is this state local ownership, a cache, or shared correctness state?
- If the process dies, can shared game behavior continue correctly?
- Is the authoritative source PostgreSQL, Redis, or Socket.IO adapter state?
- Do all game-changing actions enter `GameActionExecutor.submitAction()`?
- Are ordering, locks, timers, and idempotency handled through Redis?
- Does Socket.IO cluster behavior use adapter-aware APIs?
- Is any `namespace.sockets` usage explicitly local?
- Is test-only in-memory state confined to `server/tests`?
- Does startup/shutdown affect only this instance unless a documented recovery mode says otherwise?

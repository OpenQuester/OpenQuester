# ADR 0003 — RealtimeGateway port for application realtime output

Status: Accepted

## Context

OpenQuester uses Socket.IO today, but application logic should not be tightly coupled to transport APIs. Game actions, timers, stats, and services need to request realtime output without importing Socket.IO or Express.

Direct Socket.IO imports in application code make tests harder and blur architecture boundaries.

## Decision

Application-owned realtime output goes through `application/ports/realtime/RealtimeGateway.ts` or declared broadcast mutations processed by application infrastructure.

Socket.IO-specific delivery is implemented in `presentation/realtime/SocketIORealtimeGateway.ts`.

## Consequences

Good:

- Application services stay transport-agnostic.
- Presentation owns Socket.IO details such as namespace, rooms, socket IDs, and server-side context updates.
- Future transport changes or test doubles are easier.
- Agents have a clear rule: no Socket.IO imports in application logic.

Trade-offs:

- Some realtime behavior needs explicit event/target modeling.
- Very transport-specific side effects may need presentation hooks after action execution.

## Agent rules

- Do not import `socket.io` from `application/`.
- Do not emit directly from application use cases.
- Use broadcast mutations for game-action result broadcasts.
- Use `RealtimeGateway` for application-level realtime port behavior.
- Keep Socket.IO namespace/room/socket mechanics in presentation adapters or hooks.
- If a new realtime side effect cannot be represented, first check whether a new mutation type or gateway method is the right abstraction.

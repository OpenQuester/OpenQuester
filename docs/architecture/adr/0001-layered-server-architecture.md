# ADR 0001 — Layered server architecture

Status: Accepted

## Context

OpenQuester backend is a realtime multiplayer game server. It must keep game rules testable, protect race-sensitive state, support REST and Socket.IO presentation, and isolate infrastructure details where practical.

Agents frequently touch server code. Without an explicit architecture decision, they may introduce shortcuts such as direct database/socket usage from presentation or domain logic that depends on infrastructure.

## Decision

Use a layered architecture:

```text
bootstrap/  -> composition root; may import all layers
presentation -> application -> domain
application -> infrastructure only where current pragmatic code already does so
shared/     -> dependency-neutral contracts/config/context/logging
```

Layer responsibilities:

- `domain/` owns pure rules, entities, DTOs, mappers, validators, errors, and state-machine logic.
- `application/` owns orchestration, use cases, action executors, services, workers, jobs, factories, and app-owned ports.
- `infrastructure/` owns TypeORM/PostgreSQL, Redis, object storage, logging implementations, migrations, and external adapters.
- `presentation/` owns Express, Socket.IO setup/dispatch, middleware, request validation, and transport adapters.
- `shared/` owns dependency-neutral contracts such as DI tokens, config, logging interfaces, and request/socket context types.
- `bootstrap/` wires the runtime.

## Consequences

Good:

- Domain logic is easier to test and reason about.
- Realtime transport can evolve behind a port.
- Presentation stays thin and does not directly mutate game state.
- Agents have a predictable place for new behavior.

Trade-offs:

- Some application services currently call infrastructure repositories/adapters directly. This is allowed as pragmatic existing architecture, but should not become presentation/infrastructure leakage.
- Ports/interfaces should be introduced for clear boundary benefits, not ceremony.

## Agent rules

- Do not import application/infrastructure/presentation from `domain/`.
- Do not import presentation from `application/`.
- Do not import infrastructure directly from `presentation/`.
- Use `bootstrap/bootstrapContainer.ts` for DI composition.
- Use `application/ports/realtime/RealtimeGateway.ts` for application-owned realtime output.
- Reject stale docs that refer to removed architecture roots such as `application/Container.ts`.

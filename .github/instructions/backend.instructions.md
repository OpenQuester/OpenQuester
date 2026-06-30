---
applyTo: "server/**/*"
---

# OpenQuester backend instructions

This file exists for GitHub Copilot compatibility. The canonical backend agent instructions live in:

- `AGENTS.md` — repository-wide router
- `server/AGENTS.md` — backend architecture and coding rules
- `.agents/skills/backend-socket-action/SKILL.md` — socket/game action workflow
- `docs/agent/03-verification-matrix.md` — validation commands

## Current backend source of truth

The backend currently uses:

- `bootstrap/bootstrapContainer.ts` as the tsyringe composition root.
- `shared/di/tokens.ts` for DI tokens.
- `presentation/controllers/io/SocketActionDispatcher.ts` for Socket.IO dispatch.
- `presentation/controllers/io/SocketActionMap.ts` as the socket event → action map.
- `application/executors/GameActionExecutor.ts` for queued game-changing actions.
- `application/executors/DataMutationProcessor.ts` for declared side effects.
- `application/ports/realtime/RealtimeGateway.ts` for transport-agnostic realtime output.

## Do not use stale patterns

Do not implement new backend work with these legacy/stale references unless the files are deliberately reintroduced in the same PR:

- `application/Container.ts`
- `presentation/index.ts` as socket action registration root
- `BaseSocketEventHandler<TInput, TOutput>`
- `SocketEventHandlerRegistry`
- `domain/orchestrators/GameOrchestrator.ts`

## Before changing server code

Read `server/AGENTS.md`. For public socket actions, also read `.agents/skills/backend-socket-action/SKILL.md` and update OpenAPI/socket docs when the public contract changes.

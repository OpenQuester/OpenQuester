---
name: backend-runtime-event
description: Use when changing backend timers, scheduled work, Redis expiration handlers, pub/sub listeners, cleanup work, or lifecycle notifications.
---

# Backend runtime event skill

Use this skill for backend behavior that runs outside a direct HTTP or socket request: timers, Redis expiration handlers, scheduled cleanup, and lifecycle notifications.

## Read first

1. `server/AGENTS.md`
2. `docs/agent/03-verification-matrix.md`
3. `server/docs/game-action-executor.md` if timer expiration creates game actions
4. Relevant release-gate docs if stability or cleanup is affected

## Files to inspect

- `server/src/application/handlers/**`
- `server/src/domain/types/redis/RedisExpirationHandler.ts`
- `server/src/application/services/redis/RedisPubSubService.ts`
- `server/src/application/services/cron/**`
- `server/src/application/factories/CronJobFactory.ts`
- `server/src/bootstrap/bootstrapContainer.ts`
- `server/src/ServeApi.ts`
- relevant Redis constants/services

## Architecture invariant

Runtime handlers still follow the same boundaries:

- handler adapts the runtime signal
- application service/use case owns orchestration
- domain owns reusable rule logic
- game-changing effects should use the same action/mutation path when appropriate

## Implementation steps

1. Identify trigger type: expiration, schedule, timer, pub/sub, startup recovery, or cleanup.
2. Find the existing handler/factory/registration pattern.
3. Keep handler registration centralized in bootstrap/factory code.
4. Make the operation idempotent when possible.
5. Define failure behavior and logging context.
6. Avoid hidden game mutations outside the established game action/mutation flow.
7. Add tests or manual verification notes for runtime behavior.
8. Update diagnostics/docs if the event affects release readiness.

## Common failure modes

- Handler runs twice and mutates state twice.
- Expiration handling assumes game state still exists.
- Cleanup removes state still needed by active games.
- Runtime event bypasses game action queue and creates race conditions.
- Handler registration is added in a second place instead of the existing bootstrap/factory pattern.

## Verification

From `server/`:

```bash
npm run lint
npm run build
```

For timers, do not wait with `setTimeout`; use test helpers or trigger expiration logic directly.

## Handoff checklist

Report trigger type, registration point, idempotency behavior, state touched, game impact, logging/diagnostics impact, and checks run or skipped.

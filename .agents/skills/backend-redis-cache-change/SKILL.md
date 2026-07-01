---
name: backend-redis-cache-change
description: Use when changing Redis or cache behavior.
---

# Backend Redis cache change skill

Use this skill when changing server state stored in Redis or cache-backed services.

## Read first

1. `server/AGENTS.md`
2. `server/docs/game-action-executor.md` if game action queue behavior is touched
3. `server/docs/media-download-sync.md` if media readiness state is touched
4. `docs/agent/03-verification-matrix.md`

## Files to inspect

- `server/src/domain/constants/redisKeys.ts`
- `server/src/application/services/redis/**`
- `server/src/infrastructure/cache/**`
- `server/src/infrastructure/database/repositories/RedisRepository.ts`
- `server/src/application/services/queue/**`
- `server/src/application/services/pipeline/**`
- `server/src/application/handlers/**`

## Design rules

- Prefer existing Redis naming helpers.
- Define TTL units clearly.
- Keep derived state cleanup visible.
- Use batching helpers when several Redis writes must stay together.
- Preserve game action ordering.
- Do not let cache misses change business behavior unexpectedly.

## Implementation steps

1. Identify owner and namespace.
2. Check existing constants/services before adding a new pattern.
3. Decide TTL, cleanup, and recovery behavior.
4. Decide whether write ordering matters.
5. Update queue/pipeline code only with focused tests or careful review.
6. Update diagnostics or release-gate docs if this state affects debugging.
7. Update specs when Redis behavior is product-visible.

## Common failure modes

- Mixing milliseconds and seconds.
- Adding derived state without cleanup.
- Breaking game action ordering by bypassing queue helpers.
- Cache misses become user-visible bugs.
- Startup recovery or orphan cleanup is forgotten.

## Verification

From `server/`:

```bash
npm run lint
npm run build
```

For Redis behavior, run focused integration tests when Redis is available.

## Handoff checklist

Report Redis/cache names changed, TTL/cleanup behavior, ordering assumptions, game fairness impact, and checks run or skipped.

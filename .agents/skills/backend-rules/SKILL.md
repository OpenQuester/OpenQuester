---
name: backend-rules
description: Use when changing backend game, package, validation, or service rules.
---

# Backend rules skill

Use this skill for backend behavior changes that are not just transport wiring.

## Read first

1. `server/AGENTS.md`
2. `docs/specs/game-state-matrix.md` if gameplay state changes
3. Relevant product/spec docs for the feature area
4. `docs/agent/03-verification-matrix.md`

## Files to inspect

Likely backend files:

- `server/src/domain/entities/**`
- `server/src/domain/logic/**`
- `server/src/domain/validators/**`
- `server/src/domain/mappers/**`
- `server/src/domain/types/**`
- `server/src/application/usecases/**`
- `server/src/application/services/**`
- existing tests for the changed behavior

## Ownership rule

Reusable rules belong close to the domain model. Orchestration belongs in application services/use cases. Transport adaptation belongs in presentation.

## Implementation steps

1. Identify the rule or invariant being changed.
2. Locate the existing entity, logic helper, validator, or use case that owns it.
3. Keep reusable or non-trivial rules in `domain/`.
4. Keep persistence, timers, and broadcasts in application/use-case mutation flow.
5. Preserve edge cases around roles, eligibility, score clamps, No Risk, timers, skipped/answered players, and final round phases.
6. Update DTOs/mappers only when boundary data changes.
7. Update specs if user-visible behavior changes.
8. Add focused tests for the changed rule and at least one failure or edge case.

## Refactor vs behavior change

Before editing, classify the task:

- `behavior_change` — expected output or user-visible behavior changes.
- `refactor_only` — behavior should remain identical.
- `bug_fix` — behavior changes only for broken cases.

For refactor-only tasks, preserve tests and avoid changing DTOs/events/errors unless required.

## Common failure modes

- Putting repository or transport access in `domain/`.
- Changing score or phase behavior without tests.
- Updating frontend expectations without changing backend payloads or OpenAPI.
- Fixing one role while breaking showman/player/spectator differences.
- Treating a product-target spec as current implementation without checking code.

## Verification

From `server/`:

```bash
npm run lint
npm run build
```

Run focused tests for the changed rule. For game-state behavior, prefer integration-style tests with Redis/PostgreSQL available. Do not use `setTimeout` for timer tests; use `TestUtils.expireTimer()`.

## Handoff checklist

Report the rule changed, behavior vs refactor classification, domain/application files touched, user-visible/spec impact, and tests/checks run or skipped.

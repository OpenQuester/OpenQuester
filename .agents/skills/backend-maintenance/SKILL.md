---
name: backend-maintenance
description: Use for backend bug fixes, cleanup, extraction, or moving code between layers while preserving behavior and architecture boundaries.
---

# Backend maintenance skill

Use this skill when the task is a backend bug fix, cleanup, extraction, or refactor rather than a new public feature.

## Read first

1. `server/AGENTS.md`
2. Relevant ADR if architecture boundaries are touched
3. `docs/agent/04-docs-drift-policy.md` if docs become stale
4. `docs/agent/03-verification-matrix.md`

## Work category

Before editing, classify the task:

- `refactor_only` — behavior must remain identical.
- `bug_fix` — behavior changes only for broken or edge cases.
- `cleanup` — readability/structure improves without behavior change.
- `extraction` — logic moves to a better owner.

If the category changes during work, update the handoff summary.

## Implementation steps

1. Identify current behavior and tests before changing code.
2. Keep the diff as small as possible.
3. Move logic toward the correct layer: domain rules to `domain/`, orchestration to `application/`, transport code to `presentation/`.
4. Avoid renaming/moving many files unless the task requires it.
5. Do not mix refactor with formatting-only churn.
6. Preserve public DTOs, event names, errors, and logs unless the task says otherwise.
7. Add or adjust tests for bug fixes and risky refactors.
8. Update docs/skills/specs if the architecture or workflow changed.

## Common failure modes

- Refactor silently changes behavior.
- Fix touches unrelated modules.
- Transport-specific logic leaks into application/domain.
- Public contract changes are not documented or generated.
- Tests are changed to match broken behavior instead of desired behavior.
- Documentation still describes the old flow after the change.

## Verification

From `server/`:

```bash
npm run lint
npm run build
```

Run focused tests for touched behavior. If no test exists and the change is risky, add one or document why not.

## Handoff checklist

Report work category, behavior expected to change or not change, layer ownership changes, tests/checks run or skipped, and docs updated or why not needed.

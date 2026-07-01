# Decision navigation

Use this file before broad project decisions: frontend design, backend architecture, validation structure, release planning, product workflows, or new subsystems.

## Rule

Do not start with code for broad decisions. First collect context, read the right docs, and produce a plan.

## What to read

- Product: `docs/product/00-north-star.md`, `docs/product/01-release-plan.md`.
- Gameplay: `docs/specs/game-state-matrix.md`, `docs/specs/buzzer-state-machine.md`, relevant `server/docs/*`, relevant backend code.
- Frontend: `client/AGENTS.md`, `.agents/skills/frontend-game-ui-state/SKILL.md`, Context7 docs for Flutter/Dart and touched packages.
- Backend architecture: `server/AGENTS.md`, `docs/architecture/adr/`, relevant backend skill.
- API contract: `openapi/AGENTS.md`, `.agents/skills/openapi-sdk-change/SKILL.md`, `.agents/skills/backend-http-api/SKILL.md`.
- Socket/game action: `.agents/skills/backend-socket-action/SKILL.md`, `server/docs/game-action-executor.md`.
- Backend rules/refactor: `.agents/skills/backend-rules/SKILL.md`, `.agents/skills/backend-maintenance/SKILL.md`.
- Redis/runtime: `.agents/skills/backend-redis-cache-change/SKILL.md`, `.agents/skills/backend-runtime-event/SKILL.md`.
- Package/editor: `.agents/skills/package-editor-change/SKILL.md`, package specs.
- Validation: `.agents/skills/project-assurance/SKILL.md`, `docs/agent/03-verification-matrix.md`.
- Docs: `.agents/skills/docs-upkeep/SKILL.md`, `docs/agent/02-source-of-truth.md`, `docs/agent/04-docs-drift-policy.md`.

## Plan shape

For broad work, provide goal, non-goals, current state with file evidence, constraints, proposed structure, risks, verification plan, and docs that need updates.

## ADR/spec trigger

Create or update an ADR/spec when the decision changes architecture boundaries, public contracts, user-visible game behavior, validation strategy, release priorities, or recurring agent workflow.

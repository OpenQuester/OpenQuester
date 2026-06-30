# AGENTS.md — OpenQuester agent router

This file is the first stop for Codex/Copilot-style agents. Keep it short. It routes agents to the right source-of-truth documents instead of trying to describe the whole repository.

## Project shape

OpenQuester is a multiplayer quiz platform inspired by SIGame, with a strong focus on clear realtime game state, package/editor workflows, and stable multiplayer infrastructure.

Top-level areas:

- `server/` — TypeScript/Node.js backend: Express, Socket.IO, PostgreSQL, Redis, TypeORM, tsyringe.
- `client/` — Flutter/Dart app and local packages managed through Melos.
- `openapi/` — OpenAPI schema and Socket.IO contract metadata. Generated Dart code lives in `client/packages/openapi/`.
- `loadtest/` — TypeScript load testing tool.
- `websites/` — Hugo docs/landing pages.
- `docs/` — product, architecture, agent workflows, and implementation specs.
- `.agents/skills/` — repeatable Codex skills for high-risk workflows.

## Read order for agents

1. Read this file.
2. Read the nearest scoped `AGENTS.md` for the files you will touch:
   - `server/AGENTS.md`
   - `client/AGENTS.md`
   - `openapi/AGENTS.md`
3. Read the relevant workflow or spec:
   - `docs/agent/01-repo-map.md`
   - `docs/agent/02-source-of-truth.md`
   - `docs/agent/03-verification-matrix.md`
   - `docs/agent/04-docs-drift-policy.md`
   - `docs/specs/game-state-matrix.md`
   - `docs/specs/buzzer-state-machine.md`
   - `docs/specs/siq-compatibility-matrix.md`
   - `docs/specs/package-validation-spec.md`
4. If the task matches a repeatable workflow, use the relevant skill in `.agents/skills/`.

## Product rule

OpenQuester should not merely copy SIGame. It should make the game easier to understand, faster to start, safer to host, and better for package creators.

The core product rule is:

> Every player, showman, and spectator should understand what is happening, what they can do now, why an action is unavailable, and why a result happened.

For gameplay changes, do not treat UI text, disabled states, timers, role-specific CTAs, and feedback as polish. They are part of the feature.

## Source of truth

- Product direction: `docs/product/00-north-star.md` and `docs/product/01-release-plan.md`.
- Backend architecture: `server/AGENTS.md` and `docs/architecture/adr/`.
- Frontend architecture and UI patterns: `client/AGENTS.md`.
- API schema and contract metadata: `openapi/AGENTS.md` and `openapi/schema.json`.
- Generated Dart API package: `client/packages/openapi/`.
- Game state/product behavior: `docs/specs/game-state-matrix.md` and feature-specific specs.
- Existing deep implementation references: `server/docs/`.

If implementation and docs disagree, do not guess. Inspect the current code, fix the stale documentation in the same change when it is in scope, and call out the drift in the PR summary.

## Hard boundaries

- Do not bypass `GameActionExecutor` for game-changing socket actions.
- Do not mutate game state directly from presentation/controller code.
- Do not emit Socket.IO directly from application use cases; return declared mutations or use the realtime port.
- Do not manually edit generated Dart OpenAPI files unless a scoped doc explicitly says the file is temporarily manual.
- Do not introduce architecture-wide refactors while doing a feature task unless explicitly requested.
- Do not bring back legacy backend patterns such as `BaseSocketEventHandler`, `application/Container.ts`, or `domain/orchestrators/GameOrchestrator.ts` unless those files are reintroduced intentionally in the same PR.

## Verification quick map

Use `docs/agent/03-verification-matrix.md` for the full matrix.

Common checks:

```bash
# run from server/
npm run validate:schema
npm run lint
npm run build
npm test

# run from client/
melos run pre_build
melos run analyze
melos run test
melos run format
```

Only run the checks relevant to the changed area when local infrastructure or time makes full validation impractical. Always report what was and was not run.

## Commit and PR style

- Use Conventional Commit style when practical: `docs:`, `feat:`, `fix:`, `refactor:`.
- Prefer small, reviewable diffs.
- Avoid formatting-only churn.
- Keep draft PRs as drafts until a human decides otherwise.
- Do not merge your own PR unless explicitly instructed.

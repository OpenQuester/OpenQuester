# Agent repo map

This map helps agents pick the right files before editing. It is not a replacement for scoped `AGENTS.md` files.

## Top-level areas

| Area | Purpose | First doc to read |
|---|---|---|
| `server/` | Backend API, realtime game server, Redis/PostgreSQL/S3, game state execution | `server/AGENTS.md` |
| `web/` | React browser client: auth, packages, lobby, gameplay, results; Playwright E2E | `web/AGENTS.md` |
| `openapi/` | REST + Socket.IO public contract schema. REST declarations live in `web/src/api/schema.d.ts`. | `openapi/AGENTS.md` |
| `websites/` | Static docs/landing pages | nearby README/docs |
| `.agents/skills/` | Repeatable agent workflows | relevant `SKILL.md` |
| `docs/product/` | Product direction and release priorities | `docs/product/00-north-star.md` |
| `docs/specs/` | Behavior specs agents should preserve/update | feature-specific spec |
| `docs/architecture/adr/` | Architecture decisions and why they exist | relevant ADR |

## Backend map

| Need | Inspect first |
|---|---|
| Add/change socket game action | `server/src/presentation/controllers/io/SocketActionMap.ts`, `server/src/application/config/ActionHandlerConfig.ts`, `.agents/skills/backend-socket-action/SKILL.md` |
| Understand queue/race safety | `server/src/application/executors/GameActionExecutor.ts`, `server/docs/game-action-executor.md` |
| Add side effect | `server/src/domain/types/action/DataMutation.ts`, `server/src/application/executors/DataMutationProcessor.ts` |
| Change realtime delivery | `server/src/application/ports/realtime/RealtimeGateway.ts`, `server/src/presentation/realtime/SocketIORealtimeGateway.ts` |
| Change REST endpoint | relevant `presentation/controllers/rest/*`, `presentation/schemes/*`, application service/use case, `openapi/schema.json` |
| Change DI binding | `server/src/shared/di/tokens.ts`, `server/src/bootstrap/bootstrapContainer.ts` |
| Change game rules | `server/src/domain/entities/game/Game.ts`, `server/src/domain/logic/**`, `server/src/domain/validators/**` |
| Change final round | `server/docs/final-round-flow.md`, final round use cases/types, `docs/specs/game-state-matrix.md` |
| Change media readiness | `server/docs/media-download-sync.md`, media download use case, `web/src/game/media.ts`, browser connection and play views |
| Write/review backend transport E2E | `.agents/skills/backend-e2e/SKILL.md`, `server/tests/e2e/README.md` |
| Run/debug backend tests | `.agents/skills/backend-test-runner/SKILL.md`, `server/scripts/test/runPipelineTests.mjs` |
| Change admin diagnostics | `server/src/application/services/admin/*`, `server/src/presentation/controllers/rest/AdminRestApiController.ts` |

## React browser map

Start with `web/AGENTS.md`; it owns React structure, lifecycle invariants, styles,
and commands. Use `docs/agent/03-verification-matrix.md` for validation.

| Need | Inspect first |
|---|---|
| App routes and layout | `web/src/app/` |
| Gameplay, lobby, connection | `web/src/features/game/`, `web/src/game/`, game-state and buzzer specs |
| Package editor and media | `web/src/features/package-editor/`, `docs/specs/media-editor.md` |
| Import/upload | `web/src/features/upload/`, SIQ compatibility and upload-state specs |
| Shared UI, theme and strings | `web/src/ui/`, `web/src/theme/`, `web/src/i18n/` |
| Admin/storage/stats | corresponding `web/src/features/` folders and feature specs |

## Product/spec map

| Question | Read |
|---|---|
| Is this MVP/Beta/Later? | `docs/product/01-release-plan.md` |
| What is the product principle? | `docs/product/00-north-star.md` |
| What should each role see in game phase X? | `docs/specs/game-state-matrix.md` |
| How should answer button states behave? | `docs/specs/buzzer-state-machine.md` |
| How should imported SIGame features be handled? | `docs/specs/siq-compatibility-matrix.md` |
| What makes a package publish-ready? | `docs/specs/package-validation-spec.md` |

## Safe default workflow

1. Identify touched area.
2. Read nearest scoped `AGENTS.md`.
3. Read the relevant skill/spec.
4. Inspect existing code patterns before writing new code.
5. Make the smallest safe change.
6. Run relevant verification from `docs/agent/03-verification-matrix.md`.
7. Update docs/specs if behavior changed.
8. Report what was changed, why, and what was not verified.

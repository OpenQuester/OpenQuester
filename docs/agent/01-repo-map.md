# Agent repo map

This map helps agents pick the right files before editing. It is not a replacement for scoped `AGENTS.md` files.

## Top-level areas

| Area | Purpose | First doc to read |
|---|---|---|
| `server/` | Backend API, realtime game server, Redis/PostgreSQL/S3, game state execution | `server/AGENTS.md` |
| `client/` | Flutter app, editor packages, SIQ import, compression, generated API usage | `client/AGENTS.md` |
| `openapi/` | REST + Socket.IO public contract schema. Generated Dart code lives in `client/packages/openapi/`. | `openapi/AGENTS.md` |
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
| Change media readiness | `server/docs/media-download-sync.md`, media download use case, client question/lobby controllers |
| Change admin diagnostics | `server/src/application/services/admin/*`, `server/src/presentation/controllers/rest/AdminRestApiController.ts` |

## Frontend map

| Need | Inspect first |
|---|---|
| Change gameplay screen | `client/apps/client/lib/src/features/game_*`, `.agents/skills/frontend-game-ui-state/SKILL.md`, `docs/specs/game-state-matrix.md` |
| Change buzzer/answer UI | `client/apps/client/lib/src/features/game_question/`, `docs/specs/buzzer-state-machine.md` |
| Change socket handling | `client/apps/client/lib/src/features/game_lobby/controllers/`, generated socket/event models in `client/packages/openapi/` |
| Change package editor | `client/packages/oq_editor/`, `.agents/skills/package-editor-change/SKILL.md` |
| Change SIQ import | `client/packages/siq_file/`, `client/packages/oq_editor/lib/utils/siq_import_helper.dart`, `docs/specs/siq-compatibility-matrix.md` |
| Change package compression/export | `client/packages/oq_compress/`, `client/packages/oq_editor/lib/utils/oq_package_archiver.dart` |
| Add user-facing string | localization JSON in `client/apps/client/assets/localization/`, generated locale keys |
| Change generated API models | `openapi/schema.json`, `client/packages/openapi/`, `openapi/AGENTS.md`, `.agents/skills/openapi-sdk-change/SKILL.md` |

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

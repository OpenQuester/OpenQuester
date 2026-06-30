---
name: backend-socket-action
description: Use when adding or changing server Socket.IO game events, GameActionType handlers, action use cases, socket payloads, GameActionExecutor flows, or public socket contracts. Do not use for REST-only endpoint changes.
---

# Backend socket action skill

Use this skill when adding or changing a server-side Socket.IO event, `GameActionType`, game action handler/use case, socket payload, or public game event contract.

## Trigger examples

- “add socket event”
- “add game action”
- “change answer/buzzer/final/media event”
- “broadcast new game state”
- “add direct socket action”
- “update SocketActionMap”

## Read first

1. `server/AGENTS.md`
2. `server/docs/how-to-add-socket-action.md`
3. `server/docs/game-action-executor.md`
4. `docs/specs/game-state-matrix.md` for gameplay-facing changes
5. `openapi/AGENTS.md` if the public event/payload changes

## Files to inspect

Minimum backend files:

- `server/src/domain/enums/SocketIOEvents.ts`
- `server/src/domain/enums/GameActionType.ts`
- `server/src/presentation/controllers/io/SocketActionMap.ts`
- `server/src/presentation/controllers/io/SocketActionDispatcher.ts`
- `server/src/application/config/ActionHandlerConfig.ts`
- `server/src/application/executors/GameActionExecutor.ts`
- `server/src/application/executors/DataMutationProcessor.ts`
- relevant `server/src/application/usecases/**`
- relevant `server/src/domain/types/socket/**`
- relevant `server/src/domain/validators/**`

For public contract changes:

- `openapi/schema.json`
- generated Dart client/models in `client/packages/openapi/` after regeneration
- affected client socket listeners/controllers

## Architecture invariant

Game-changing actions must use the queued executor path:

```text
SocketActionDispatcher -> SocketActionMap -> GameActionExecutor.submitAction -> handler/use case -> DataMutationProcessor
```

Do not directly mutate game state from presentation. Do not directly emit Socket.IO from application use cases.

Only use `directExecution: true` for actions that never mutate game state. Chat-style non-mutating actions are the model example.

## Implementation steps

1. Define or update socket event enum.
2. Define or update `GameActionType`.
3. Define payload/output interfaces in `domain/types/socket/**` when public or reused.
4. Add/adjust Joi/domain validation.
5. Add/update `SOCKET_ACTION_MAP` entry.
6. Implement a use case/action handler under `application/usecases/**` or the nearest existing pattern.
7. Keep reusable rules in `domain/logic/**` or validators.
8. Return `ActionHandlerResult` with `DataMutation[]`.
9. Register handler in `application/config/ActionHandlerConfig.ts`.
10. Process new mutation types in `DataMutationProcessor` only if existing mutations cannot express the side effect.
11. Update OpenAPI socket metadata if public contract changed.
12. Update frontend generated models/listeners if needed.
13. Add tests for success, validation failure, role/phase failure, and race-sensitive behavior when applicable.

## Use case pattern

Conceptual shape:

```ts
export class MyActionUseCase implements GameActionHandler<MyInput, MyOutput> {
  public async execute(ctx: ActionExecutionContext<MyInput>): Promise<ActionHandlerResult<MyOutput>> {
    const { game } = ctx;

    MyDomainLogic.validate(game, ctx.action.payload);
    MyDomainLogic.apply(game, ctx.action.payload);

    return {
      success: true,
      data: { /* output */ },
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        DataMutationConverter.gameBroadcastMutation(game.id, SocketIOGameEvents.MY_EVENT, { /* payload */ })
      ],
      broadcastGame: game
    };
  }
}
```

Match nearby project code over this sketch.

## Common failure modes

- Adding event enum but forgetting `SOCKET_ACTION_MAP`.
- Adding use case but forgetting `ActionHandlerConfig` registration.
- Emitting directly from use case instead of returning mutations.
- Using `directExecution: true` for a game-changing action.
- Forgetting OpenAPI/socket contract metadata.
- Forgetting frontend generated types/listeners.
- Not handling invalid role/phase/eligibility.
- Adding race-sensitive behavior without a queued-action test.

## Verification

From `server/`:

```bash
npm run validate:schema
npm run lint
npm run build
```

For behavior changes, add/run focused Jest tests. For full confidence with infra available:

```bash
npm test
```

If client contract changes, from `client/`:

```bash
melos run gen_api
melos run gen_files
melos run analyze
```

Report what was run and what was skipped.

## PR summary checklist

Include:

- event/action added or changed
- whether it mutates game state or is direct execution
- domain rules touched
- mutations emitted
- OpenAPI/client impact
- tests/checks run
- known gaps or follow-up

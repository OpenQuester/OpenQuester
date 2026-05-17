# How To Add A Socket Game Action

Socket game actions are config-driven. `SocketActionDispatcher` registers events from `SocketActionMap`, builds a `GameAction`, and sends it through `GameActionExecutor`.

## Flow

```text
SocketActionDispatcher -> SocketActionMap -> GameActionExecutor -> UseCase -> DataMutationProcessor
```

Most game-changing actions are serialized per game by the Redis-backed lock and queue. See `game-action-executor.md` for details.

## Steps

1. Add the socket event to `src/domain/enums/SocketIOEvents.ts`.
2. Add the action type to `src/domain/enums/GameActionType.ts`.
3. Add or reuse input/output interfaces in `src/domain/types/socket/`.
4. Add payload validation to `src/domain/validators/GameValidator.ts` or a more specific validator.
5. Add an entry to `SOCKET_ACTION_MAP` in `src/presentation/controllers/io/SocketActionMap.ts`.
6. Implement a use case in `src/application/usecases/` that implements `GameActionHandler<TInput, TOutput>`.
7. Register the use case in `src/application/config/ActionHandlerConfig.ts`.
8. Return side effects as `DataMutation[]` instead of performing hidden writes or emits inside the use case.
9. Add a hook in `src/presentation/controllers/io/SocketActionHooks.ts` only for transport-level side effects that must happen after execution.
10. Add or update socket tests for success, validation failure, and queue-sensitive behavior when applicable.

## `SocketActionMap` Entry

```typescript
{
  event: SocketIOGameEvents.MY_EVENT,
  actionType: GameActionType.MY_ACTION,
  gameIdStrategy: GameIdStrategy.FROM_SESSION,
  inputValidator: (data) => GameValidator.validateMyEvent(data as never),
}
```

Use `GameIdStrategy.FROM_PAYLOAD` only when the client must choose the game before the socket is associated with one, such as joining a game.

Use `directExecution: true` only for actions that do not mutate game state. Chat is the model example.

## Use Case Pattern

```typescript
export class MyActionUseCase implements GameActionHandler<MyInput, MyOutput> {
  public async execute(
    ctx: ActionExecutionContext<MyInput>
  ): Promise<ActionHandlerResult<MyOutput>> {
    const { game } = ctx;

    MyDomainLogic.validate(game, ctx.action.payload);
    MyDomainLogic.apply(game, ctx.action.payload);

    return {
      success: true,
      data: { /* output */ },
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        DataMutationConverter.gameBroadcastMutation(
          game.id,
          SocketIOGameEvents.MY_EVENT,
          { /* broadcast data */ }
        ),
      ],
      broadcastGame: game,
    };
  }
}
```

## Mutation Rules

- Save changed game state with `DataMutationConverter.saveGameMutation(game)`.
- Emit socket events with broadcast mutations.
- Set or delete timers with timer mutations.
- Add new mutation types only when an existing mutation cannot represent the side effect.
- Process new mutation types in `src/application/executors/DataMutationProcessor.ts`.

## Checklist

- Event enum, action enum, action map entry, use case, and handler registration all exist.
- Input validation happens before the action is built.
- Game-changing actions do not use `directExecution`.
- The use case returns declared mutations instead of directly writing Redis or emitting sockets.
- Domain rules are extracted to `domain/` when reusable or non-trivial.
- Tests cover bad payloads and expected broadcasts.

import { describe, expect, it, jest } from "@jest/globals";

import { lockKey } from "domain/constants/redisKeys";
import { GameActionType } from "domain/enums/GameActionType";
import { QUEUE_ACTION_AND_TRY_LOCK_SCRIPT } from "domain/lua/actionLuaScripts";
import { type GameAction, type SerializedGameAction } from "domain/types/action/GameAction";
import { GameActionQueueService } from "application/services/queue/GameActionQueueService";
import { type RedisService } from "application/services/redis/RedisService";

function createAction(): GameAction<{ answer: string }> {
  return {
    id: "action-1",
    type: GameActionType.QUESTION_ANSWER,
    gameId: "GAME1",
    playerId: 42,
    socketId: "socket-1",
    timestamp: new Date("2026-05-09T12:00:00.000Z"),
    payload: { answer: "42" }
  };
}

describe("GameActionQueueService", () => {
  it("queues an action while trying to start the processor atomically", async () => {
    const evalRedis = jest.fn(
      async (
        _script: string,
        _keyCount: number,
        _queueKey: string,
        _lockKey: string,
        _serializedAction: string,
        token: string
      ): Promise<[number, string]> => [1, token]
    );
    const service = new GameActionQueueService({ eval: evalRedis } as unknown as RedisService);

    const action = createAction();

    const result = await service.queueActionAndTryStartProcessor(action);

    expect(result).toEqual({
      shouldProcessQueue: true,
      lockToken: expect.any(String)
    });
    expect(evalRedis).toHaveBeenCalledWith(
      QUEUE_ACTION_AND_TRY_LOCK_SCRIPT,
      2,
      "game:action:queue:GAME1",
      lockKey("GAME1"),
      expect.any(String),
      result.lockToken,
      20
    );

    const serialized = JSON.parse(evalRedis.mock.calls[0][4] as string) as SerializedGameAction;
    expect(serialized.timestamp).toBe(action.timestamp.toISOString());
    expect(serialized.payload).toBe(JSON.stringify(action.payload));
  });

  it("still queues an action when another processor owns the lock", async () => {
    const evalRedis = jest.fn(
      async (): Promise<[number, string]> => [0, ""]
    );
    const service = new GameActionQueueService({ eval: evalRedis } as unknown as RedisService);

    const result = await service.queueActionAndTryStartProcessor(createAction());

    expect(result).toEqual({
      shouldProcessQueue: false,
      lockToken: ""
    });
    expect(evalRedis).toHaveBeenCalledTimes(1);
  });
});

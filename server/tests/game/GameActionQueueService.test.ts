import { describe, expect, it, jest } from "@jest/globals";

import { GameActionType } from "domain/enums/GameActionType";
import { type GameAction, type SerializedGameAction } from "domain/types/action/GameAction";
import {
  type GameActionLockService,
  type LockAcquireResult
} from "application/services/lock/GameActionLockService";
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
  it("queues an action before trying to start the processor", async () => {
    const rpush = jest.fn(async (_key: string, _value: string): Promise<number> => 1);
    const acquireLock = jest.fn(
      async (_gameId: string): Promise<LockAcquireResult> => ({
        acquired: true,
        token: "token-1"
      })
    );
    const service = new GameActionQueueService(
      { rpush } as unknown as RedisService,
      { acquireLock } as unknown as GameActionLockService
    );

    const action = createAction();

    const result = await service.queueActionAndTryStartProcessor(action);

    expect(result).toEqual({
      shouldProcessQueue: true,
      lockToken: "token-1"
    });
    expect(rpush).toHaveBeenCalledWith("game:action:queue:GAME1", expect.any(String));
    expect(rpush.mock.invocationCallOrder[0]).toBeLessThan(acquireLock.mock.invocationCallOrder[0]);

    const serialized = JSON.parse(rpush.mock.calls[0][1]) as SerializedGameAction;
    expect(serialized.timestamp).toBe(action.timestamp.toISOString());
    expect(serialized.payload).toBe(JSON.stringify(action.payload));
  });

  it("still queues an action when another processor owns the lock", async () => {
    const rpush = jest.fn(async (_key: string, _value: string): Promise<number> => 1);
    const acquireLock = jest.fn(
      async (_gameId: string): Promise<LockAcquireResult> => ({
        acquired: false,
        token: "token-2"
      })
    );
    const service = new GameActionQueueService(
      { rpush } as unknown as RedisService,
      { acquireLock } as unknown as GameActionLockService
    );

    const result = await service.queueActionAndTryStartProcessor(createAction());

    expect(result).toEqual({
      shouldProcessQueue: false,
      lockToken: ""
    });
    expect(rpush).toHaveBeenCalledTimes(1);
    expect(acquireLock).toHaveBeenCalledTimes(1);
  });
});

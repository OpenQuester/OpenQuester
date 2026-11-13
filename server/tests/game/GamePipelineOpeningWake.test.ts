import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { GameActionLockService } from "application/services/lock/GameActionLockService";
import { GamePipelineService } from "application/services/pipeline/GamePipelineService";
import type { RedisService } from "application/services/redis/RedisService";
import { MEDIA_DOWNLOAD_TIMEOUT } from "domain/constants/game";
import { questionTransitionTimerKey, timerKey } from "domain/constants/redisKeys";
import { DataMutationType } from "domain/enums/DataMutationType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import type { GameIndexManager } from "infrastructure/database/managers/game/GameIndexManager";
import {
  buildGame,
  buildTimer,
  TestLogger
} from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

const gameId = "WAKE";
const openingKey = questionTransitionTimerKey(gameId);
const indexData = buildGame(gameId, null).toIndexData();
const openingSet = (ttlMs: number) =>
  DataMutationConverter.setTimerMutation(openingKey, "{}", ttlMs);
const openingDelete = DataMutationConverter.deleteTimerMutation(openingKey);

function setup() {
  const exec = jest
    .fn<() => Promise<[Error | null, unknown][]>>()
    .mockResolvedValue([[null, "OK"]]);
  const get = jest.fn<RedisService["get"]>().mockResolvedValue(null);
  const pipeline = {
    exec,
    set: jest.fn(),
    del: jest.fn(),
    hset: jest.fn(),
    expire: jest.fn()
  };
  const service = new GamePipelineService(
    { pipeline: () => pipeline, get } as unknown as RedisService,
    {} as GameActionLockService,
    { removeGameFromIndexesPipeline: jest.fn() } as unknown as GameIndexManager,
    new TestLogger()
  );
  const write = (input: Partial<Parameters<GamePipelineService["executeOutPipeline"]>[0]>) =>
    service.executeOutPipeline(
      { saveGame: null, deleteGame: null, timerSets: [], timerDeletes: [], ...input },
      gameId,
      indexData
    );
  return { exec, get, write };
}

describe("game timer wake", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("wakes only the opening key once, after its latest committed TTL", async () => {
    const { get, write } = setup();
    await write({
      timerSets: [
        openingSet(100),
        DataMutationConverter.setTimerMutation(timerKey(gameId, QuestionState.SHOWING), "{}", 25)
      ]
    });
    await jest.advanceTimersByTimeAsync(50);
    await write({ timerDeletes: [openingDelete], timerSets: [openingSet(200)] });
    await jest.advanceTimersByTimeAsync(200);
    expect(get).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(openingKey);
  });

  it.each(["pause", "phase exit", "game deletion"] as const)(
    "cancels the pending wake after %s",
    async (mode) => {
      const { get, write } = setup();
      await write({ timerSets: [openingSet(100)] });
      if (mode === "pause") {
        await write({ timerDeletes: [openingDelete] });
      } else if (mode === "phase exit") {
        await write({ saveGame: DataMutationConverter.saveGameMutation(buildGame(gameId, null)) });
      } else {
        await write({ deleteGame: { type: DataMutationType.DELETE_GAME, gameId } });
      }
      await jest.advanceTimersByTimeAsync(101);
      expect(get).not.toHaveBeenCalled();
    }
  );

  it("retains the prior wake when a replacement pipeline fails", async () => {
    const { exec, get, write } = setup();
    await write({ timerSets: [openingSet(100)] });
    exec.mockResolvedValueOnce([[new Error("write failed"), null]]);
    await expect(write({ timerSets: [openingSet(200)] })).rejects.toThrow("write failed");
    await jest.advanceTimersByTimeAsync(101);
    expect(get).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(100);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("wakes a buzzer draw once, after its latest committed deadline", async () => {
    const { get, write } = setup();
    const game = buildGame(gameId, buildTimer());
    game.gameState.buzzerWindow = { openedAt: Date.now(), presses: [2] };
    const saveGame = DataMutationConverter.saveGameMutation(game);
    const key = timerKey(gameId);
    await write({ saveGame, timerSets: [DataMutationConverter.setTimerMutation(key, "{}", 300)] });
    await jest.advanceTimersByTimeAsync(100);
    await write({ saveGame, timerSets: [DataMutationConverter.setTimerMutation(key, "{}", 250)] });
    await jest.advanceTimersByTimeAsync(250);
    expect(get).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(key);
  });

  it("wakes the active media timeout after replacing an earlier active deadline", async () => {
    const { get, write } = setup();
    const key = timerKey(gameId);
    await write({ timerSets: [DataMutationConverter.setTimerMutation(key, "{}", 300)] });
    await jest.advanceTimersByTimeAsync(100);
    const game = buildGame(gameId, buildTimer());
    game.setQuestionState(QuestionState.MEDIA_DOWNLOADING);
    const saveGame = DataMutationConverter.saveGameMutation(game);
    await write({
      saveGame,
      timerDeletes: [DataMutationConverter.deleteTimerMutation(key)],
      timerSets: [DataMutationConverter.setTimerMutation(key, "{}", MEDIA_DOWNLOAD_TIMEOUT)]
    });
    await write({ saveGame });
    await jest.advanceTimersByTimeAsync(MEDIA_DOWNLOAD_TIMEOUT);
    expect(get).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(key);
  });

  it.each(["pause", "phase exit", "game deletion"] as const)(
    "cancels the pending active timer wake after %s",
    async (mode) => {
      const { get, write } = setup();
      const game = buildGame(gameId, buildTimer());
      const saveGame = DataMutationConverter.saveGameMutation(game);
      const key = timerKey(gameId);
      const timerSet = DataMutationConverter.setTimerMutation(key, "{}", 300);
      await write({ saveGame, timerSets: [timerSet] });
      if (mode === "pause") {
        game.pause();
        await write({ saveGame, timerDeletes: [DataMutationConverter.deleteTimerMutation(key)] });
      } else if (mode === "phase exit") {
        game.setTimer(null);
        await write({ saveGame });
      } else {
        await write({ deleteGame: { type: DataMutationType.DELETE_GAME, gameId } });
      }
      await jest.advanceTimersByTimeAsync(301);
      expect(get).not.toHaveBeenCalled();
    }
  );
});

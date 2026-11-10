import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { container } from "tsyringe";
import { GameService } from "application/services/game/GameService";
import { timerKey } from "domain/constants/redisKeys";
import { Game } from "domain/entities/game/Game";
import { RedisConfig } from "shared/config/RedisConfig";
import { SocketGameTestStateUtils } from "./SocketGameTestStateUtils";

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("controlled question playback clock", () => {
  it.each([false, true])("advances only the delivery lead (resumed: %s)", async (resumed) => {
    const now = new Date("2026-11-08T12:00:00Z");
    jest.useFakeTimers({ now });
    const timer = {
      durationMs: 30000,
      elapsedMs: resumed ? 5000 : 0,
      startedAt: new Date(now.getTime() + (resumed ? -10000 : 1750)),
      resumedAt: resumed ? new Date(now.getTime() + 200) : null
    };
    const game = { gameState: { timer, isPaused: false } } as Game;
    const updateGame = jest.fn<() => Promise<void>>(async () => undefined);
    jest.spyOn(container, "resolve").mockReturnValue({
      getGameEntity: async () => game,
      updateGame
    } as unknown as GameService);
    const set = jest.fn<(...args: unknown[]) => Promise<"OK">>(async () => "OK");
    jest
      .spyOn(RedisConfig, "getClient")
      .mockReturnValue({ set } as unknown as ReturnType<typeof RedisConfig.getClient>);

    await new SocketGameTestStateUtils().startQuestionPlayback("clock-test");

    expect(timer.resumedAt ?? timer.startedAt).toEqual(now);
    expect(timer.durationMs).toBe(30000);
    expect(timer.elapsedMs).toBe(resumed ? 5000 : 0);
    expect(updateGame).toHaveBeenCalledWith(game);
    expect(set).toHaveBeenCalledWith(
      timerKey("clock-test"),
      JSON.stringify(timer),
      "PX",
      resumed ? 25000 : 30000
    );
  });
});

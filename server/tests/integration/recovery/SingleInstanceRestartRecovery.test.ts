import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";

import { bootstrapContainer, container } from "bootstrap/bootstrapContainer";
import { SingleInstanceRestartRecoveryService } from "application/services/recovery/SingleInstanceRestartRecoveryService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { timerKey } from "domain/constants/redisKeys";
import { SOCKET_GAME_NAMESPACE, SOCKET_USER_PREFIX } from "domain/constants/socket";
import { type GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { SocketIORealtimeGateway } from "presentation/realtime/SocketIORealtimeGateway";
import { RedisConfig } from "shared/config/RedisConfig";
import { Environment } from "shared/config/Environment";
import { Database } from "infrastructure/database/Database";
import { GameRepository } from "infrastructure/database/repositories/GameRepository";
import { SocketUserDataRepository } from "infrastructure/database/repositories/socket/SocketUserDataRepository";
import {
  activeTimerTtlMs,
  buildGame,
  buildTimer,
  oldStartedAt,
  recoveryTimerDurationMs,
  TestLogger
} from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";
import { TestEnvironment } from "tests/TestEnvironment";

describe("SingleInstanceRestartRecovery real Redis integration", () => {
  let logger: TestLogger;
  let testEnvironment: TestEnvironment | undefined;
  let io: IOServer | undefined;
  let gameRepository: GameRepository;
  let socketUserDataRepository: SocketUserDataRepository;
  let recoveryService: SingleInstanceRestartRecoveryService;

  beforeEach(async () => {
    logger = new TestLogger();
    testEnvironment = new TestEnvironment(logger);
    await testEnvironment.setup();
    process.env.STARTUP_RECOVERY_ENABLED = "true";
    const env = Environment.getInstance(logger, { overwrite: true });
    env.load(true);
    const httpServer = createServer();
    io = new IOServer(httpServer);
    const db = Database.getInstance(testEnvironment.getDatabase(), logger);
    await db.build();

    await bootstrapContainer({
      db,
      redisClient: RedisConfig.getClient(),
      io,
      realtimeGateway: new SocketIORealtimeGateway(io.of(SOCKET_GAME_NAMESPACE)),
      env,
      logger
    });

    gameRepository = container.resolve(GameRepository);
    socketUserDataRepository = container.resolve(SocketUserDataRepository);
    recoveryService = container.resolve(SingleInstanceRestartRecoveryService);
  });

  afterEach(async () => {
    try {
      await RedisConfig.disconnect();
    } finally {
      await io?.close();
      await testEnvironment?.teardown();
      container.reset();
      delete process.env.STARTUP_RECOVERY_ENABLED;
    }
  });

  it("recovers active question timers as paused full-duration restart timers", async () => {
    const redis = RedisConfig.getClient();
    const game = buildGame("RCV1", buildTimer());
    await gameRepository.updateGame(game);
    await gameRepository.saveTimer(buildTimer(), game.id, undefined, activeTimerTtlMs);

    const result = await recoveryService.recoverIfEnabled();

    expect(result.status).toBe("completed");
    const recoveredGame = await gameRepository.getGameEntity(game.id);
    const activeTimer = await redis.get(timerKey(game.id));
    const pausedTimerRaw = await redis.get(timerKey(game.id, QuestionState.SHOWING));
    const pausedTimerTtl = await redis.pttl(timerKey(game.id, QuestionState.SHOWING));
    const gameTtl = await redis.ttl(gameRepository.getGameKey(game.id));

    expect(recoveredGame.players.map((player) => player.gameStatus)).toEqual([
      PlayerGameStatus.DISCONNECTED,
      PlayerGameStatus.DISCONNECTED,
      PlayerGameStatus.DISCONNECTED
    ]);
    expect(recoveredGame.gameState.isPaused).toBe(true);
    expect(recoveredGame.gameState.timer).toBeNull();
    expect(activeTimer).toBeNull();
    expect(pausedTimerRaw).not.toBeNull();
    const pausedTimer = JSON.parse(pausedTimerRaw!) as GameStateTimerDTO;
    expect(pausedTimer.durationMs).toBe(recoveryTimerDurationMs);
    expect(pausedTimer.elapsedMs).toBe(0);
    expect(new Date(pausedTimer.startedAt).getTime()).toBeGreaterThan(oldStartedAt.getTime());
    expect(pausedTimer.resumedAt).toBeNull();
    expect(pausedTimerTtl).toBeGreaterThan(recoveryTimerDurationMs);
    expect(gameTtl).toBeGreaterThan(0);
    expect(recoveredGame.gameState.questionState).toBe(QuestionState.SHOWING);
    expect(recoveredGame.gameState.currentQuestion?.text).toBe("preserved question");
    expect(recoveredGame.gameState.currentRound?.description).toBe("preserved round");
    expect(recoveredGame.gameState.readyPlayers).toEqual([2]);
    expect(recoveredGame.gameState.skippedPlayers).toEqual([3]);
    expect(recoveredGame.gameState.password).toBe("SAFE");

    const resume = new SocketGameTimerService().buildUnpauseTimerMutations(
      recoveredGame,
      pausedTimer
    );
    expect(resume.timerMutations).toEqual([
      {
        op: "delete",
        key: timerKey(game.id, QuestionState.SHOWING)
      },
      expect.objectContaining({
        op: "set",
        key: timerKey(game.id),
        pxTtl: recoveryTimerDurationMs
      })
    ]);
    expect(resume.result.data.timer?.durationMs).toBe(recoveryTimerDurationMs);
    expect(resume.result.data.timer?.elapsedMs).toBe(0);
  });

  it("disconnects players without inventing paused timers when a game has no active timer", async () => {
    const game = buildGame("RCV2", null);
    await gameRepository.updateGame(game);

    await recoveryService.recoverIfEnabled();

    const recoveredGame = await gameRepository.getGameEntity(game.id);
    const pausedTimer = await gameRepository.getTimer(game.id, QuestionState.SHOWING);

    expect(
      recoveredGame.players.every(
        (player) => player.gameStatus === PlayerGameStatus.DISCONNECTED
      )
    ).toBe(true);
    expect(recoveredGame.gameState.isPaused).toBe(false);
    expect(recoveredGame.gameState.timer).toBeNull();
    expect(pausedTimer).toBeNull();
    expect(recoveredGame.gameState.questionState).toBe(QuestionState.SHOWING);
    expect(recoveredGame.gameState.currentQuestion?.text).toBe("preserved question");
    expect(recoveredGame.gameState.skippedPlayers).toEqual([3]);
  });

  it("clears socket session keys and preserves unrelated Redis keys", async () => {
    const redis = RedisConfig.getClient();
    await socketUserDataRepository.set("socket-recovery-a", {
      userId: 51,
      language: "en",
      mutedUntil: null
    });
    await socketUserDataRepository.set("socket-recovery-b", {
      userId: 52,
      language: "en",
      mutedUntil: null
    });
    await redis.set("unrelated:single-instance-recovery", "preserved");

    await recoveryService.recoverIfEnabled();

    await expect(socketUserDataRepository.getSocketData("socket-recovery-a")).resolves.toBeNull();
    await expect(socketUserDataRepository.getSocketData("socket-recovery-b")).resolves.toBeNull();
    await expect(socketUserDataRepository.findSocketIdByUserId(51)).resolves.toBeNull();
    await expect(socketUserDataRepository.findSocketIdByUserId(52)).resolves.toBeNull();
    await expect(redis.get(`${SOCKET_USER_PREFIX}:51`)).resolves.toBeNull();
    await expect(redis.get("unrelated:single-instance-recovery")).resolves.toBe("preserved");
  });

  it("resets to full duration instead of subtracting downtime", async () => {
    const game = buildGame("RCV3", {
      ...buildTimer(),
      elapsedMs: recoveryTimerDurationMs - 1
    });
    await gameRepository.updateGame(game);
    await gameRepository.saveTimer(game.gameState.timer!, game.id, undefined, 1);

    await recoveryService.recoverIfEnabled();

    const pausedTimer = await gameRepository.getTimer(game.id, QuestionState.SHOWING);
    expect(pausedTimer).toMatchObject({
      durationMs: recoveryTimerDurationMs,
      elapsedMs: 0
    });
  });
});

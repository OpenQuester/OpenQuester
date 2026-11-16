import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";

import { bootstrapContainer, container } from "bootstrap/bootstrapContainer";
import { SingleInstanceRestartRecoveryService } from "application/services/recovery/SingleInstanceRestartRecoveryService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { questionTransitionTimerKey, timerKey } from "domain/constants/redisKeys";
import { SOCKET_GAME_NAMESPACE, SOCKET_USER_PREFIX } from "domain/constants/socket";
import { MIN_TIMER_TTL_MS } from "domain/constants/timer";
import { QuestionScriptLogic } from "domain/logic/question/QuestionScriptLogic";
import { type GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
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
import { teardownTestAppResources } from "tests/TestApp";

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
    const currentIo = io;
    const currentTestEnvironment = testEnvironment;
    io = undefined;
    testEnvironment = undefined;

    const teardownFailures: unknown[] = [];
    try {
      await teardownTestAppResources(
        currentIo ? () => closeSocketIoServer(currentIo) : undefined,
        currentTestEnvironment
      );
    } catch (error) {
      teardownFailures.push(error);
    }

    try {
      container.reset();
    } catch (error) {
      teardownFailures.push(error);
    } finally {
      delete process.env.STARTUP_RECOVERY_ENABLED;
    }

    if (teardownFailures.length === 1) {
      throw teardownFailures[0];
    }
    if (teardownFailures.length > 1) {
      throw new AggregateError(teardownFailures, "Single-instance recovery test teardown failed");
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

  it("preserves a scripted answer and rearms an exhausted secret price for immediate expiry", async () => {
    const now = Date.now();
    const scriptGame = buildGame("RCVS", null);
    QuestionScriptLogic.start(
      scriptGame,
      {
        ...scriptGame.gameState.currentQuestion!,
        script: {
          version: 1,
          steps: [
            { op: "setAnswerer", mode: "current" },
            { op: "askAnswer", mode: "direct", durationMs: recoveryTimerDurationMs }
          ]
        }
      },
      10,
      2
    );
    scriptGame.setTimer({
      ...buildTimer(),
      elapsedMs: 6000,
      resumedAt: new Date(now - 2000)
    });
    await gameRepository.updateGame(scriptGame);
    await gameRepository.saveTimer(
      scriptGame.gameState.timer!,
      scriptGame.id,
      undefined,
      activeTimerTtlMs
    );

    const priceGame = buildGame("RCVP", { ...buildTimer(), startedAt: new Date(now - 31_000) });
    priceGame.setQuestionState(QuestionState.SECRET_TRANSFER);
    priceGame.gameState.currentQuestion = null;
    priceGame.gameState.secretQuestionData = {
      questionId: 20,
      pickerPlayerId: 2,
      transferDecisionPhase: false,
      transferType: PackageQuestionTransferType.ANY,
      step: "price",
      actorPlayerId: 3,
      recipientPlayerId: 3,
      priceSelection: { playerId: 3, allowedPrices: [], range: { min: 200, max: 600, step: 200 } }
    };
    await gameRepository.updateGame(priceGame);

    await recoveryService.recoverIfEnabled();

    const restoredScript = await gameRepository.getGameEntity(scriptGame.id);
    expect(restoredScript.gameState).toMatchObject({
      questionState: QuestionState.ANSWERING,
      isPaused: true,
      timer: null,
      answeringPlayer: 2,
      scriptProgress: { programCounter: 2, waitingFor: "answer", actorId: 2 }
    });
    expect(await gameRepository.getTimer(scriptGame.id)).toBeNull();
    const scriptTimer = (await gameRepository.getTimer(scriptGame.id, QuestionState.ANSWERING))!;
    expect(scriptTimer.elapsedMs).toBeGreaterThanOrEqual(8000);
    expect(scriptTimer.elapsedMs).toBeLessThan(recoveryTimerDurationMs);
    const timerService = new SocketGameTimerService();
    expect(
      timerService.buildUnpauseTimerMutations(restoredScript, scriptTimer).timerMutations
    ).toContainEqual(
      expect.objectContaining({
        op: "set",
        key: timerKey(scriptGame.id),
        pxTtl: recoveryTimerDurationMs - scriptTimer.elapsedMs
      })
    );

    const restoredPrice = await gameRepository.getGameEntity(priceGame.id);
    expect(restoredPrice.gameState).toMatchObject({
      questionState: QuestionState.SECRET_TRANSFER,
      isPaused: true,
      timer: null,
      secretQuestionData: priceGame.gameState.secretQuestionData
    });
    const priceTimer = await gameRepository.getTimer(priceGame.id, QuestionState.SECRET_TRANSFER);
    expect(priceTimer).toMatchObject({
      durationMs: recoveryTimerDurationMs,
      elapsedMs: recoveryTimerDurationMs
    });
    expect(
      timerService.buildUnpauseTimerMutations(restoredPrice, priceTimer).timerMutations
    ).toContainEqual(
      expect.objectContaining({ op: "set", key: timerKey(priceGame.id), pxTtl: MIN_TIMER_TTL_MS })
    );
  });

  it("recovers a transition-only text question into a paused restore point", async () => {
    const game = buildGame("RCVT", null);
    game.setQuestionState(QuestionState.MEDIA_DOWNLOADING);
    game.gameState.questionTransition = {
      timer: { ...buildTimer(), durationMs: 1550 },
      mediaReady: true
    };
    await gameRepository.updateGame(game);
    const key = questionTransitionTimerKey(game.id);
    await RedisConfig.getClient().set(
      key,
      JSON.stringify(game.gameState.questionTransition.timer),
      "PX",
      1550
    );
    await recoveryService.recoverIfEnabled();
    const recovered = await gameRepository.getGameEntity(game.id);
    expect(recovered.gameState.isPaused).toBe(true);
    expect(recovered.gameState.timer).toBeNull();
    expect(recovered.gameState.questionTransition?.timer.elapsedMs).toBe(0);
    expect(await RedisConfig.getClient().exists(key)).toBe(0);
    const resumed = new SocketGameTimerService().buildUnpauseTimerMutations(recovered, null);
    expect(resumed.timerMutations).toContainEqual(
      expect.objectContaining({ op: "set", key, pxTtl: 1550 })
    );
  });

  it("disconnects players without inventing paused timers when a game has no active timer", async () => {
    const game = buildGame("RCV2", null);
    await gameRepository.updateGame(game);

    await recoveryService.recoverIfEnabled();

    const recoveredGame = await gameRepository.getGameEntity(game.id);
    const pausedTimer = await gameRepository.getTimer(game.id, QuestionState.SHOWING);

    expect(
      recoveredGame.players.every((player) => player.gameStatus === PlayerGameStatus.DISCONNECTED)
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

  it.each([false, true])(
    "resets to full duration instead of subtracting downtime (legacy price=%s)",
    async (legacyPrice) => {
      const game = buildGame("RCV3", {
        ...buildTimer(),
        elapsedMs: recoveryTimerDurationMs - 1
      });
      const state = legacyPrice ? QuestionState.SECRET_TRANSFER : QuestionState.SHOWING;
      if (legacyPrice) {
        game.setQuestionState(state);
        game.gameState.currentQuestion = null;
        game.gameState.secretQuestionData = {
          questionId: 20,
          pickerPlayerId: 2,
          transferDecisionPhase: false,
          transferType: PackageQuestionTransferType.ANY,
          step: "price",
          actorPlayerId: 3,
          recipientPlayerId: 3,
          priceSelection: { playerId: 3, allowedPrices: [100, 300] }
        };
      }
      await gameRepository.updateGame(game);
      await gameRepository.saveTimer(game.gameState.timer!, game.id, undefined, 1);

      await recoveryService.recoverIfEnabled();

      const pausedTimer = await gameRepository.getTimer(game.id, state);
      expect(pausedTimer).toMatchObject({
        durationMs: recoveryTimerDurationMs,
        elapsedMs: 0
      });
    }
  );
});

async function closeSocketIoServer(ioServer: IOServer | undefined): Promise<void> {
  if (!ioServer) {
    return;
  }

  try {
    await ioServer.close();
  } catch (error) {
    if (isBenignPreListenSocketIoCloseError(error)) {
      return;
    }

    throw error;
  }
}

function isBenignPreListenSocketIoCloseError(error: unknown): boolean {
  return (
    error instanceof Error &&
    hasErrorCode(error, "ERR_SERVER_NOT_RUNNING") &&
    error.message === "Server is not running."
  );
}

function hasErrorCode(error: Error, code: string): boolean {
  return (
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code === code
  );
}

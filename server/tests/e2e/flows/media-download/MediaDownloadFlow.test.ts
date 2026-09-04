import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { type Repository } from "typeorm";
import { container } from "tsyringe";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { type PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { type PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";

import { GAME_QUESTION_ANSWER_TIME, MEDIA_DOWNLOAD_TIMEOUT } from "domain/constants/game";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { type User } from "infrastructure/database/models/User";

import {
  type CreateMediaDownloadFlowOptions,
  MediaDownloadFlow,
  withMediaDownloadFlow
} from "tests/e2e/flows/media-download/MediaDownloadFlow";
import { type ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import {
  type GameClientSocket,
  type GameTestSetup,
  type SocketGameTestUtils
} from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import { type TestUtils } from "tests/utils/TestUtils";
import { TEST_MEDIA_FILE_MD5 } from "tests/utils/PackageUtils";

interface FakeSocket {
  readonly id: string;
  readonly nsp: string;
  readonly connected: boolean;
  readonly onAny: jest.Mock;
  readonly offAny: jest.Mock;
  readonly emit: jest.Mock;
  readonly disconnect: jest.Mock;
  readonly removeAllListeners: jest.Mock;
  readonly close: jest.Mock;
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("MediaDownloadFlow lifecycle", () => {
  it.each([
    { defect: "none", expected: undefined },
    { defect: "skipped media phase", expected: '"media_downloading"' },
    { defect: "wrong active timer", expected: "10000" },
    { defect: "wrong data timer", expected: "fresh 10000ms timer" },
    { defect: "missing files", expected: "files mismatch" }
  ])("validates question data and pre-ACK state ($defect)", async ({ defect, expected }) => {
    const sockets = [
      createSocket("showman-socket"),
      createSocket("player-socket"),
      createSocket("spectator-socket")
    ];
    const setup = createReadySetup(sockets[0], sockets[1], sockets[2]);
    const probe = {
      waitForCount: jest.fn(async () => undefined),
      records: jest.fn(() => []),
      dispose: jest.fn()
    };
    const detach = jest.fn();
    const utils = {
      useScenario: jest.fn(() => detach),
      setupGameTestEnvironment: jest.fn(async () => setup),
      cleanupGameClients: jest.fn(async () => undefined),
      startGame: jest.fn(async () => undefined),
      getFirstAvailableQuestionId: jest.fn(async () => 42),
      getGameState: jest.fn(async () => ({
        questionState:
          defect === "skipped media phase"
            ? QuestionState.SHOWING
            : QuestionState.MEDIA_DOWNLOADING,
        timer: createTimer(
          defect === "wrong active timer" ? GAME_QUESTION_ANSWER_TIME : MEDIA_DOWNLOAD_TIMEOUT
        )
      })),
      createAcceptedActionProbe: jest.fn(() => probe),
      waitForActionsComplete: jest.fn(async () => undefined)
    } as unknown as SocketGameTestUtils;
    jest.spyOn(container, "resolve").mockReturnValue({
      getQuestion: jest.fn(async () => ({ id: 42, questionFiles: createQuestionFiles() }))
    } as unknown as PackageStore);
    sockets[0].emit.mockImplementation(() => {
      for (const [index, socket] of sockets.entries()) {
        const payload = createQuestionData(42, index === 0);
        if (defect === "missing files") payload.data.questionFiles = [];
        if (defect === "wrong data timer") payload.timer = createTimer(GAME_QUESTION_ANSWER_TIME);
        emitInbound(socket, SocketIOGameEvents.QUESTION_DATA, payload);
      }
    });

    const result = withMediaDownloadFlow(createOptions(utils), async (flow) => {
      const mark = await flow.pickMediaQuestion();
      flow.assertExactQuestionDataCount(flow.allRecipients, mark, 1);
    });
    if (expected) await expect(result).rejects.toThrow(expected);
    else await expect(result).resolves.toBeUndefined();

    expect(utils.useScenario).toHaveBeenCalledTimes(1);
    expect(detach).toHaveBeenCalledTimes(1);
    expect(detach.mock.invocationCallOrder[0]).toBeLessThan(
      (utils.cleanupGameClients as jest.Mock).mock.invocationCallOrder[0]
    );
    expect(utils.cleanupGameClients).toHaveBeenCalledWith(setup);
    expect(sockets[1].emit).not.toHaveBeenCalled();
    expect(sockets[2].emit).not.toHaveBeenCalled();
    sockets.forEach((socket) => expect(socket.offAny).toHaveBeenCalledTimes(1));
  });

  it.each(["single", "broadcast"] as const)(
    "owns a forgotten derived %s validation, not just its event wait",
    async (kind) => {
      const sockets = [createSocket("showman"), createSocket("player"), createSocket("spectator")];
      const setup = createReadySetup(sockets[0], sockets[1], sockets[2]);
      const utils = {
        useScenario: jest.fn(() => jest.fn()),
        setupGameTestEnvironment: jest.fn(async () => setup),
        cleanupGameClients: jest.fn(async () => undefined)
      } as unknown as SocketGameTestUtils;
      await expect(
        withMediaDownloadFlow(createOptions(utils), async (flow) => {
          const expected = {
            playerId: 2,
            allPlayersReady: true,
            timerDurationMs: GAME_QUESTION_ANSWER_TIME
          };
          if (kind === "single")
            void flow.waitForMediaDownloadStatus(flow.showman, flow.mark(), expected);
          else void flow.waitForMediaDownloadBroadcast(flow.allRecipients, flow.mark(), expected);
          sockets.forEach((socket) =>
            emitInbound(socket, SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS, {
              playerId: 2,
              mediaDownloaded: true,
              allPlayersReady: true,
              timer: createTimer(MEDIA_DOWNLOAD_TIMEOUT)
            })
          );
        })
      ).rejects.toThrow(`fresh ${GAME_QUESTION_ANSWER_TIME}ms timer`);
      expect(utils.cleanupGameClients).toHaveBeenCalledWith(setup);
    }
  );

  it("preserves primary, detach, and client cleanup failures", async () => {
    const setup = createReadySetup(
      createSocket("showman"),
      createSocket("player"),
      createSocket("spectator")
    );
    const utils = {
      useScenario: jest.fn(() => () => {
        throw new Error("detach failed");
      }),
      setupGameTestEnvironment: jest.fn(async () => setup),
      cleanupGameClients: jest.fn(async () => {
        throw new Error("clients failed");
      })
    } as unknown as SocketGameTestUtils;
    await expect(
      withMediaDownloadFlow(createOptions(utils), async () => {
        throw new Error("primary failure");
      })
    ).rejects.toThrow(/primary failure.*detach failed.*clients failed/);
    expect(utils.cleanupGameClients).toHaveBeenCalledWith(setup);
  });

  it("closes every created socket when actor construction fails after setup", async () => {
    const showmanSocket = createSocket("showman-socket");
    const playerSocket = createSocket("player-socket");
    const spectatorSocket = createSocket("spectator-socket");
    const setup = createSetup(showmanSocket, playerSocket, spectatorSocket);
    const cleanupGameClients = jest.fn(async (partialSetup: GameTestSetup) => {
      for (const socket of [
        partialSetup.showmanSocket,
        ...partialSetup.playerSockets,
        ...partialSetup.spectatorSockets
      ]) {
        socket.disconnect();
        socket.removeAllListeners();
        socket.close();
      }
    });
    const utils = {
      useScenario: jest.fn(() => jest.fn()),
      setupGameTestEnvironment: jest.fn(async () => setup),
      cleanupGameClients
    } as unknown as SocketGameTestUtils;

    await expect(
      withMediaDownloadFlow(createOptions(utils), async () => undefined)
    ).rejects.toThrow("player actor construction failed");

    expect(cleanupGameClients).toHaveBeenCalledWith(setup);
    expectSocketsClosed([showmanSocket, playerSocket, spectatorSocket]);
  });

  it("aborts abandoned media expectations after a primary callback failure", async () => {
    const showmanSocket = createSocket("showman-socket");
    const playerSocket = createSocket("player-socket");
    const spectatorSocket = createSocket("spectator-socket");
    const setup = createReadySetup(showmanSocket, playerSocket, spectatorSocket);
    const cleanupGameClients = jest.fn(async () => undefined);
    const utils = {
      useScenario: jest.fn(() => jest.fn()),
      setupGameTestEnvironment: jest.fn(async () => setup),
      cleanupGameClients
    } as unknown as SocketGameTestUtils;
    const unhandledRejection = jest.fn();
    process.once("unhandledRejection", unhandledRejection);

    try {
      await expect(
        withMediaDownloadFlow(createOptions(utils), async (flow) => {
          const afterSequence = flow.mark();
          const expected = {
            playerId: 2,
            allPlayersReady: false,
            timerDurationMs: null
          };

          void flow.waitForMediaDownloadStatus(flow.showman, afterSequence, expected);
          void flow.waitForMediaDownloadBroadcast(flow.allRecipients, afterSequence, expected);
          void flow.waitForAllPlayersReadyBroadcast(flow.allRecipients, afterSequence);

          throw new Error("primary scenario failure");
        })
      ).rejects.toThrow("primary scenario failure");
      await Promise.resolve();

      expect(cleanupGameClients).toHaveBeenCalledWith(setup);
      expect(unhandledRejection).not.toHaveBeenCalled();
    } finally {
      process.removeListener("unhandledRejection", unhandledRejection);
    }
  });

  it("fails successful completion for a forgotten media expectation", async () => {
    jest.useFakeTimers();
    const setup = createReadySetup(
      createSocket("showman-socket"),
      createSocket("player-socket"),
      createSocket("spectator-socket")
    );
    const cleanupGameClients = jest.fn(async () => undefined);
    const utils = {
      useScenario: jest.fn(() => jest.fn()),
      setupGameTestEnvironment: jest.fn(async () => setup),
      cleanupGameClients
    } as unknown as SocketGameTestUtils;
    const flow = await MediaDownloadFlow.start(createOptions(utils));
    const afterSequence = flow.mark();

    void flow.waitForMediaDownloadStatus(flow.showman, afterSequence, {
      playerId: 2,
      allPlayersReady: false,
      timerDurationMs: null
    });

    const completion = expect(flow.finish()).rejects.toThrow(
      `Timed out after ${TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS}ms waiting for event`
    );
    await jest.advanceTimersByTimeAsync(TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);
    await completion;

    expect(cleanupGameClients).toHaveBeenCalledWith(setup);
  });

  it("bounds forgotten state assertions when the state read never settles", async () => {
    jest.useFakeTimers();
    const setup = createReadySetup(
      createSocket("showman-socket"),
      createSocket("player-socket"),
      createSocket("spectator-socket")
    );
    const cleanupGameClients = jest.fn(async () => undefined);
    const utils = {
      useScenario: jest.fn(() => jest.fn()),
      setupGameTestEnvironment: jest.fn(async () => setup),
      cleanupGameClients,
      getGameState: jest.fn(() => new Promise(() => undefined))
    } as unknown as SocketGameTestUtils;
    const flow = await MediaDownloadFlow.start(createOptions(utils));

    void flow.expectQuestionState(QuestionState.MEDIA_DOWNLOADING);

    const completion = expect(flow.finish()).rejects.toThrow(
      `Timed out after ${TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS}ms waiting for question state`
    );
    await jest.advanceTimersByTimeAsync(TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS);
    await completion;

    expect(cleanupGameClients).toHaveBeenCalledWith(setup);
  });

  it("records exact player-management commands and probes the submitting actor", async () => {
    const showmanSocket = createSocket("showman-socket");
    const playerSocket = createSocket("player-socket");
    const spectatorSocket = createSocket("spectator-socket");
    const setup = createReadySetup(showmanSocket, playerSocket, spectatorSocket);
    const acceptedProbe = {
      waitForCount: jest.fn(async () => undefined),
      records: jest.fn(() => []),
      dispose: jest.fn()
    };
    const createAcceptedActionProbe = jest.fn(() => acceptedProbe);
    const utils = {
      useScenario: jest.fn(() => jest.fn()),
      setupGameTestEnvironment: jest.fn(async () => setup),
      cleanupGameClients: jest.fn(async () => undefined),
      createAcceptedActionProbe
    } as unknown as SocketGameTestUtils;
    const flow = await MediaDownloadFlow.start(createOptions(utils));
    const player = flow.player(0);
    const afterCommands = flow.mark();

    flow.emitPlayerLeave(player);
    flow.emitPlayerKick(player);
    flow.emitPlayerRestriction(player);
    flow.createAcceptedActorActionProbe(flow.showman, GameActionType.PLAYER_RESTRICTION);

    flow.assertOutboundCommandCount(player, SocketIOGameEvents.LEAVE, afterCommands, 1);
    flow.assertOutboundCommandCount(
      flow.showman,
      SocketIOGameEvents.PLAYER_KICKED,
      afterCommands,
      1
    );
    flow.assertOutboundCommandCount(
      flow.showman,
      SocketIOGameEvents.PLAYER_RESTRICTED,
      afterCommands,
      1
    );
    expect(playerSocket.emit).toHaveBeenCalledWith(SocketIOGameEvents.LEAVE);
    expect(showmanSocket.emit).toHaveBeenCalledWith(SocketIOGameEvents.PLAYER_KICKED, {
      playerId: 2
    });
    expect(showmanSocket.emit).toHaveBeenCalledWith(SocketIOGameEvents.PLAYER_RESTRICTED, {
      playerId: 2,
      muted: false,
      restricted: true,
      banned: false
    });
    expect(createAcceptedActionProbe).toHaveBeenCalledWith({
      gameId: "game-1",
      actionType: GameActionType.PLAYER_RESTRICTION,
      playerId: 1,
      socketId: "showman-socket"
    });

    await flow.finish();
    expect(acceptedProbe.dispose).toHaveBeenCalledTimes(1);
  });
});

function createOptions(utils: SocketGameTestUtils): CreateMediaDownloadFlowOptions {
  return {
    harness: { app: {} } as ServerTestHarness,
    utils,
    userRepo: {} as Repository<User>,
    testUtils: {} as TestUtils
  };
}

function createSetup(
  showmanSocket: FakeSocket,
  playerSocket: FakeSocket,
  spectatorSocket: FakeSocket
): GameTestSetup {
  return {
    gameId: "game-1",
    showmanSocket: showmanSocket as unknown as GameClientSocket,
    playerSockets: [playerSocket as unknown as GameClientSocket],
    spectatorSockets: [spectatorSocket as unknown as GameClientSocket],
    showmanUser: { id: 1 } as User,
    playerUsers: [
      Object.defineProperty({}, "id", {
        get: () => {
          throw new Error("player actor construction failed");
        }
      }) as User
    ]
  };
}

function createReadySetup(
  showmanSocket: FakeSocket,
  playerSocket: FakeSocket,
  spectatorSocket: FakeSocket
): GameTestSetup {
  return {
    ...createSetup(showmanSocket, playerSocket, spectatorSocket),
    playerUsers: [{ id: 2 } as User]
  };
}

function createSocket(id: string): FakeSocket {
  return {
    id,
    nsp: "/games",
    connected: true,
    onAny: jest.fn(),
    offAny: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
    close: jest.fn()
  };
}

function expectSocketsClosed(sockets: readonly FakeSocket[]): void {
  for (const socket of sockets) {
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(socket.close).toHaveBeenCalledTimes(1);
  }
}

function emitInbound(socket: FakeSocket, event: string, payload: unknown): void {
  const handler = socket.onAny.mock.calls[0]?.[0] as
    | ((receivedEvent: string, receivedPayload: unknown) => void)
    | undefined;

  if (!handler) {
    throw new Error(`Socket ${socket.id} does not have an inbound journal listener`);
  }

  handler(event, payload);
}

function createQuestionData(questionId: number, isShowman: boolean) {
  return {
    data: {
      id: questionId,
      text: "Simple question text",
      ...(isShowman ? { answerText: "Simple answer" } : {}),
      questionFiles: createQuestionFiles()
    } as PackageQuestionDTO,
    timer: createTimer(MEDIA_DOWNLOAD_TIMEOUT)
  };
}

function createQuestionFiles(): PackageQuestionFileDTO[] {
  return [
    {
      file: {
        md5: TEST_MEDIA_FILE_MD5,
        link: `https://media.example.test/${TEST_MEDIA_FILE_MD5}`,
        type: PackageFileType.IMAGE
      },
      displayTime: null,
      order: 0
    }
  ];
}

function createTimer(durationMs: number) {
  return {
    startedAt: new Date(),
    durationMs,
    elapsedMs: 0,
    resumedAt: null
  };
}

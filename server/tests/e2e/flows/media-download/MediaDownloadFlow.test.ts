import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { type Repository } from "typeorm";

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
});

describe("MediaDownloadFlow lifecycle", () => {
  it("rejects a full question reveal before the media readiness gate opens", async () => {
    const showmanSocket = createSocket("showman-socket");
    const playerSocket = createSocket("player-socket");
    const spectatorSocket = createSocket("spectator-socket");
    const setup = createReadySetup(showmanSocket, playerSocket, spectatorSocket);
    const acceptedProbe = {
      waitForCount: jest.fn(async () => undefined),
      records: jest.fn(() => []),
      dispose: jest.fn()
    };
    const utils = {
      setupGameTestEnvironment: jest.fn(async () => setup),
      cleanupGameClients: jest.fn(async () => undefined),
      startGame: jest.fn(async () => undefined),
      getFirstAvailableQuestionId: jest.fn(async () => 42),
      createAcceptedActionProbe: jest.fn(() => acceptedProbe),
      waitForActionsComplete: jest.fn(async () => undefined)
    } as unknown as SocketGameTestUtils;
    showmanSocket.emit.mockImplementation((...args: unknown[]) => {
      const event = args[0];
      if (event !== SocketIOGameEvents.QUESTION_PICK) {
        return;
      }

      for (const socket of [showmanSocket, playerSocket, spectatorSocket]) {
        emitInbound(socket, SocketIOGameEvents.QUESTION_PICK, createQuestionPreload(42));
        emitInbound(socket, SocketIOGameEvents.QUESTION_DATA, createQuestionReveal(42));
      }
    });

    await expect(
      withMediaDownloadFlow(createOptions(utils), async (flow) => {
        await flow.pickMediaQuestion();
      })
    ).rejects.toThrow('Expected exactly 0 inbound "question-data" records');
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

function createQuestionPreload(questionId: number): Record<string, unknown> {
  return {
    questionId,
    questionFiles: createQuestionFiles(),
    timer: createTimer(MEDIA_DOWNLOAD_TIMEOUT)
  };
}

function createQuestionReveal(questionId: number): Record<string, unknown> {
  return {
    data: {
      id: questionId,
      questionFiles: createQuestionFiles()
    },
    timer: createTimer(GAME_QUESTION_ANSWER_TIME)
  };
}

function createQuestionFiles(): readonly Record<string, unknown>[] {
  return [
    {
      file: {
        md5: TEST_MEDIA_FILE_MD5,
        type: PackageFileType.IMAGE
      },
      displayTime: null,
      order: 0
    }
  ];
}

function createTimer(durationMs: number): Record<string, unknown> {
  return {
    startedAt: new Date(),
    durationMs,
    elapsedMs: 0,
    resumedAt: null
  };
}

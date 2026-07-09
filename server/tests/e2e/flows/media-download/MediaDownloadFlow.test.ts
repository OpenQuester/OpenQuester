import { describe, expect, it, jest } from "@jest/globals";
import { type Repository } from "typeorm";

import {
  type CreateMediaDownloadFlowOptions,
  MediaDownloadFlow,
  withMediaDownloadFlow
} from "tests/e2e/flows/media-download/MediaDownloadFlow";
import { type ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { type GameClientSocket, type GameTestSetup, type SocketGameTestUtils } from "tests/socket/game/utils/SocketIOGameTestUtils";
import { type User } from "infrastructure/database/models/User";
import { type TestUtils } from "tests/utils/TestUtils";

interface FakeSocket {
  readonly id: string;
  readonly onAny: jest.Mock;
  readonly offAny: jest.Mock;
  readonly disconnect: jest.Mock;
  readonly removeAllListeners: jest.Mock;
  readonly close: jest.Mock;
}

describe("MediaDownloadFlow startup cleanup", () => {
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

  it("observes abandoned media status expectations while disposing the flow", async () => {
    const showmanSocket = createSocket("showman-socket");
    const playerSocket = createSocket("player-socket");
    const spectatorSocket = createSocket("spectator-socket");
    const setup = createReadySetup(showmanSocket, playerSocket, spectatorSocket);
    const cleanupGameClients = jest.fn(async () => undefined);
    const utils = {
      setupGameTestEnvironment: jest.fn(async () => setup),
      cleanupGameClients
    } as unknown as SocketGameTestUtils;
    const flow = await MediaDownloadFlow.start(createOptions(utils));
    const unhandledRejection = jest.fn();
    process.once("unhandledRejection", unhandledRejection);

    try {
      const afterSequence = flow.mark();
      const expected = {
        playerId: 2,
        mediaDownloaded: true as const,
        allPlayersReady: false,
        timer: { kind: "none" as const }
      };

      void flow.waitForMediaDownloadStatus(flow.showman, afterSequence, expected);
      void flow.waitForMediaDownloadBroadcast(flow.allRecipients, afterSequence, expected);
      void flow.waitForAllPlayersReadyBroadcast(flow.allRecipients, afterSequence);

      await flow.cleanup();
      await Promise.resolve();

      expect(cleanupGameClients).toHaveBeenCalledWith(setup);
      expect(unhandledRejection).not.toHaveBeenCalled();
    } finally {
      process.removeListener("unhandledRejection", unhandledRejection);
    }
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
    onAny: jest.fn(),
    offAny: jest.fn(),
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

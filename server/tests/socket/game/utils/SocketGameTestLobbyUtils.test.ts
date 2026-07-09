import { describe, expect, it, jest } from "@jest/globals";

import { GameActionType } from "domain/enums/GameActionType";
import { type User } from "infrastructure/database/models/User";
import {
  SocketGameTestLobbyUtils,
  type SocketGameTestLobbyUtilsDependencies
} from "tests/socket/game/utils/SocketGameTestLobbyUtils";
import { type SocketGameTestEventUtils } from "tests/socket/game/utils/SocketGameTestEventUtils";
import { type SocketGameTestUserUtils } from "tests/socket/game/utils/SocketGameTestUserUtils";
import {
  type GameClientSocket,
  type GameTestSetup
} from "tests/socket/game/utils/SocketIOGameTestUtils";

interface FakeSocket {
  readonly id: string;
  connected: boolean;
  readonly disconnect: jest.Mock;
  readonly removeAllListeners: jest.Mock;
  readonly close: jest.Mock;
}

interface CleanupFixture {
  readonly gameId: string;
  readonly lobbyUtils: SocketGameTestLobbyUtils;
  readonly sockets: readonly FakeSocket[];
  readonly waitForActionsComplete: jest.Mock;
  readonly waitForSubmittedActions: jest.Mock;
  readonly getGameIdForSocket: (socketId: string) => Promise<string>;
}

const GAME_ID = "game-1";

describe("SocketGameTestLobbyUtils cleanupGameClients", () => {
  it("closes every client when the initial drain fails", async () => {
    const fixture = createFixture({
      drainFailures: [new Error("initial drain failed")]
    });

    const error = await captureFailure(() => fixture.lobbyUtils.cleanupGameClients(createSetup(fixture)));

    expect(error).toBeInstanceOf(AggregateError);
    expect(error.message).toContain("Initial action drain failed: initial drain failed");
    expectSocketsClosed(fixture.sockets);
    expect(fixture.waitForSubmittedActions).toHaveBeenCalledWith(
      GAME_ID,
      fixture.sockets.length,
      GameActionType.DISCONNECT
    );
    expect(fixture.waitForActionsComplete).toHaveBeenCalledTimes(2);
  });

  it("continues session discovery and closing when one session lookup fails", async () => {
    const fixture = createFixture({
      sessionResults: {
        "player-socket": new Error("session lookup failed")
      }
    });

    const error = await captureFailure(() => fixture.lobbyUtils.cleanupGameClients(createSetup(fixture)));

    expect(error.message).toContain(
      "Server session discovery for socket player-socket failed: session lookup failed"
    );
    expect(fixture.getGameIdForSocket).toHaveBeenCalledTimes(fixture.sockets.length);
    expect(fixture.waitForSubmittedActions).toHaveBeenCalledWith(
      GAME_ID,
      fixture.sockets.length - 1,
      GameActionType.DISCONNECT
    );
    expectSocketsClosed(fixture.sockets);
  });

  it("continues closing other clients when one client close fails", async () => {
    const fixture = createFixture();
    fixture.sockets[0].close.mockImplementation(() => {
      throw new Error("showman close failed");
    });

    const error = await captureFailure(() => fixture.lobbyUtils.cleanupGameClients(createSetup(fixture)));

    expect(error.message).toContain("Client socket close for showman-socket failed");
    expect(error.message).toContain("showman close failed");
    expect(fixture.sockets[0].disconnect).toHaveBeenCalledTimes(1);
    expect(fixture.sockets[0].removeAllListeners).toHaveBeenCalledTimes(1);
    expect(fixture.sockets[0].close).toHaveBeenCalledTimes(1);
    expect(fixture.sockets[1].close).toHaveBeenCalledTimes(1);
    expect(fixture.sockets[2].close).toHaveBeenCalledTimes(1);
    expect(fixture.waitForActionsComplete).toHaveBeenCalledTimes(2);
  });

  it("propagates disconnect wait and final drain failures after closing every client", async () => {
    const fixture = createFixture({
      drainFailures: [undefined, new Error("final drain failed")],
      disconnectWaitFailure: new Error("disconnect wait failed")
    });

    const error = await captureFailure(() => fixture.lobbyUtils.cleanupGameClients(createSetup(fixture)));

    expect(error.message).toContain("Disconnect action wait failed: disconnect wait failed");
    expect(error.message).toContain("Final action drain failed: final drain failed");
    expectSocketsClosed(fixture.sockets);
  });

  it("preserves multiple failures in deterministic operation order", async () => {
    const fixture = createFixture({
      drainFailures: [new Error("initial"), new Error("final")],
      sessionResults: { "showman-socket": new Error("session") },
      disconnectWaitFailure: new Error("disconnect")
    });
    fixture.sockets[1].close.mockImplementation(() => {
      throw new Error("close");
    });

    const error = await captureFailure(() => fixture.lobbyUtils.cleanupGameClients(createSetup(fixture)));
    const errors = getAggregateErrors(error);

    expect(errors.map((nestedError) => nestedError.message)).toEqual([
      "Initial action drain failed: initial",
      "Server session discovery for socket showman-socket failed: session",
      "Client socket close for player-socket failed: Socket client close failed: Socket close failed: close",
      "Disconnect action wait failed: disconnect",
      "Final action drain failed: final"
    ]);
  });

  it("keeps successful cleanup behavior unchanged", async () => {
    const fixture = createFixture();

    await expect(fixture.lobbyUtils.cleanupGameClients(createSetup(fixture))).resolves.toBeUndefined();

    expect(fixture.getGameIdForSocket).toHaveBeenCalledTimes(fixture.sockets.length);
    expect(fixture.waitForSubmittedActions).toHaveBeenCalledWith(
      GAME_ID,
      fixture.sockets.length,
      GameActionType.DISCONNECT
    );
    expect(fixture.waitForActionsComplete).toHaveBeenCalledTimes(2);
    expectSocketsClosed(fixture.sockets);
  });
});

describe("SocketGameTestLobbyUtils setupGameTestEnvironment", () => {
  it("closes every socket created before a partial setup failure", async () => {
    const showmanSocket = createSocket("showman-socket");
    const joinedPlayerSocket = createSocket("joined-player-socket");
    const failingPlayerSocket = createSocket("failing-player-socket");
    const createGameClient = jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValueOnce({ socket: joinedPlayerSocket, user: {} as User })
        .mockResolvedValueOnce({ socket: failingPlayerSocket, user: {} as User });
    const userUtils = {
      createGameClient
    } as unknown as SocketGameTestUserUtils;
    const lobbyUtils = new SocketGameTestLobbyUtils(
      userUtils,
      {} as SocketGameTestEventUtils,
      { socketGameContextService: { getGameIdForSocket: async () => GAME_ID } }
    );
    jest.spyOn(lobbyUtils, "createGameWithShowman").mockResolvedValue({
      socket: showmanSocket as unknown as GameClientSocket,
      gameId: GAME_ID,
      user: {} as User
    });
    jest.spyOn(lobbyUtils, "joinGame").mockImplementation(async (socket) => {
      if (socket.id === failingPlayerSocket.id) {
        throw new Error("player join failed");
      }
    });

    await expect(
      lobbyUtils.setupGameTestEnvironment({} as never, {} as never, 2, 0)
    ).rejects.toThrow("player join failed");

    expectSocketsClosed([showmanSocket, joinedPlayerSocket, failingPlayerSocket]);
  });
});

function createFixture(options: {
  readonly drainFailures?: readonly (Error | undefined)[];
  readonly sessionResults?: Readonly<Record<string, string | Error>>;
  readonly disconnectWaitFailure?: Error;
} = {}): CleanupFixture {
  const sockets = [
    createSocket("showman-socket"),
    createSocket("player-socket"),
    createSocket("spectator-socket")
  ];
  let drainAttempt = 0;
  const waitForActionsComplete = jest.fn(async () => {
    const failure = options.drainFailures?.[drainAttempt];
    drainAttempt += 1;

    if (failure) {
      throw failure;
    }
  });
  const waitForSubmittedActions = jest.fn(async () => {
    if (options.disconnectWaitFailure) {
      throw options.disconnectWaitFailure;
    }
  });
  const getGameIdForSocket = jest.fn(async (socketId: string) => {
    const result = options.sessionResults?.[socketId] ?? GAME_ID;
    if (result instanceof Error) {
      throw result;
    }

    return result;
  });
  const dependencies: SocketGameTestLobbyUtilsDependencies = {
    socketGameContextService: { getGameIdForSocket }
  };
  const lobbyUtils = new SocketGameTestLobbyUtils(
    {} as SocketGameTestUserUtils,
    {
      waitForActionsComplete,
      waitForSubmittedActions
    } as unknown as SocketGameTestEventUtils,
    dependencies
  );

  return {
    gameId: GAME_ID,
    lobbyUtils,
    sockets,
    waitForActionsComplete,
    waitForSubmittedActions,
    getGameIdForSocket
  };
}

function createSetup(fixture: CleanupFixture): GameTestSetup {
  const [showmanSocket, playerSocket, spectatorSocket] = fixture.sockets;

  return {
    gameId: fixture.gameId,
    showmanSocket: showmanSocket as unknown as GameClientSocket,
    playerSockets: [playerSocket as unknown as GameClientSocket],
    spectatorSockets: [spectatorSocket as unknown as GameClientSocket],
    showmanUser: {} as User,
    playerUsers: [{} as User]
  };
}

function createSocket(id: string): FakeSocket {
  return {
    id,
    connected: true,
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

async function captureFailure(action: () => Promise<void>): Promise<Error> {
  try {
    await action();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }

  throw new Error("Expected cleanup to fail");
}

function getAggregateErrors(error: Error): Error[] {
  if (!(error instanceof AggregateError)) {
    throw new Error(`Expected AggregateError, received ${error.constructor.name}`);
  }

  return Array.from(error.errors).map((nestedError) =>
    nestedError instanceof Error ? nestedError : new Error(String(nestedError))
  );
}

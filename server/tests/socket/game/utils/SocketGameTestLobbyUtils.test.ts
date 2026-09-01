import { describe, expect, it, jest } from "@jest/globals";

import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { type GameJoinOutputData } from "domain/types/socket/events/SocketEventInterfaces";
import { type User } from "infrastructure/database/models/User";
import { SocketGameTestLobbyUtils } from "tests/socket/game/utils/SocketGameTestLobbyUtils";
import { type SocketGameTestEventUtils } from "tests/socket/game/utils/SocketGameTestEventUtils";
import { type SocketGameTestUserUtils } from "tests/socket/game/utils/SocketGameTestUserUtils";
import {
  type GameClientSocket,
  type GameTestSetup
} from "tests/socket/game/utils/SocketIOGameTestUtils";

interface FakeSocket {
  readonly id: string;
  gameId?: string;
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
  readonly releaseSocket: jest.Mock;
}

const GAME_ID = "game-1";

describe("SocketGameTestLobbyUtils cleanupGameClients", () => {
  it("closes every client when the initial drain fails", async () => {
    const fixture = createFixture({
      drainFailures: [new Error("initial drain failed")]
    });

    const error = await captureFailure(() =>
      fixture.lobbyUtils.cleanupGameClients(createSetup(fixture))
    );

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

    const error = await captureFailure(() =>
      fixture.lobbyUtils.cleanupGameClients(createSetup(fixture))
    );

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

    const error = await captureFailure(() =>
      fixture.lobbyUtils.cleanupGameClients(createSetup(fixture))
    );

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

    const error = await captureFailure(() =>
      fixture.lobbyUtils.cleanupGameClients(createSetup(fixture))
    );

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

    const error = await captureFailure(() =>
      fixture.lobbyUtils.cleanupGameClients(createSetup(fixture))
    );
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

    await expect(
      fixture.lobbyUtils.cleanupGameClients(createSetup(fixture))
    ).resolves.toBeUndefined();

    expect(fixture.getGameIdForSocket).toHaveBeenCalledTimes(fixture.sockets.length);
    expect(fixture.waitForSubmittedActions).toHaveBeenCalledWith(
      GAME_ID,
      fixture.sockets.length,
      GameActionType.DISCONNECT
    );
    expect(fixture.waitForActionsComplete).toHaveBeenCalledTimes(2);
    expectSocketsClosed(fixture.sockets);
    expect(fixture.releaseSocket).toHaveBeenCalledTimes(fixture.sockets.length);
  });
});

describe("SocketGameTestLobbyUtils cleanupOwnedClients", () => {
  it("groups by game and continues after one disconnect wait fails", async () => {
    const gameOneSockets = [createSocket("game-1-a"), createSocket("game-1-b")];
    const gameTwoSocket = createSocket("game-2-a");
    for (const socket of gameOneSockets) socket.gameId = "game-1";
    gameTwoSocket.gameId = "game-2";
    const ownedSockets = [...gameOneSockets, gameTwoSocket];
    const releaseSocket = jest.fn();
    const waitForActionsComplete = jest.fn<() => Promise<void>>().mockResolvedValue();
    const waitForSubmittedActions = jest.fn(async (gameId: string) => {
      if (gameId === "game-1") {
        throw new Error("game-1 disconnect wait failed");
      }
    });
    const lobbyUtils = new SocketGameTestLobbyUtils(
      {
        getOwnedSockets: () => ownedSockets as unknown as GameClientSocket[],
        releaseSocket
      } as unknown as SocketGameTestUserUtils,
      {
        waitForActionsComplete,
        waitForSubmittedActions
      } as unknown as SocketGameTestEventUtils,
      {
        getGameIdForSocket: async (socketId) =>
          socketId.startsWith("game-1") ? "game-1" : "game-2"
      }
    );

    const error = await captureFailure(() => lobbyUtils.cleanupOwnedClients());

    expect(error.message).toContain("game-1 disconnect wait failed");
    expectSocketsClosed(ownedSockets);
    expect(waitForSubmittedActions).toHaveBeenCalledWith("game-1", 2, GameActionType.DISCONNECT);
    expect(waitForSubmittedActions).toHaveBeenCalledWith("game-2", 1, GameActionType.DISCONNECT);
    expect(releaseSocket).toHaveBeenCalledTimes(1);
    expect(releaseSocket).toHaveBeenCalledWith(gameTwoSocket);
  });
});

describe("SocketGameTestLobbyUtils setupGameTestEnvironment", () => {
  it("awaits accepted disconnect actions before surfacing a partial setup failure", async () => {
    const showmanSocket = createSocket("showman-socket");
    const joinedPlayerSocket = createSocket("joined-player-socket");
    const failingPlayerSocket = createSocket("failing-player-socket");
    const createGameClient = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce({ socket: joinedPlayerSocket, user: {} as User })
      .mockResolvedValueOnce({ socket: failingPlayerSocket, user: {} as User });
    const disconnectWait = createDeferred<void>();
    const disconnectWaitStarted = createDeferred<void>();
    const waitForActionsComplete = jest.fn<() => Promise<void>>().mockResolvedValue();
    const waitForSubmittedActions = jest.fn(() => {
      disconnectWaitStarted.resolve(undefined);
      return disconnectWait.promise;
    });
    const releaseSocket = jest.fn();
    const userUtils = { createGameClient, releaseSocket } as unknown as SocketGameTestUserUtils;
    const lobbyUtils = new SocketGameTestLobbyUtils(
      userUtils,
      {
        waitForActionsComplete,
        waitForSubmittedActions
      } as unknown as SocketGameTestEventUtils,
      { getGameIdForSocket: async () => GAME_ID }
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

    const setup = lobbyUtils.setupGameTestEnvironment({} as never, {} as never, 2, 0);
    await disconnectWaitStarted.promise;

    let settled = false;
    void setup.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );
    await Promise.resolve();

    expectSocketsClosed([showmanSocket, joinedPlayerSocket, failingPlayerSocket]);
    expect(settled).toBe(false);
    disconnectWait.resolve(undefined);

    await expect(setup).rejects.toThrow("player join failed");
    expect(waitForSubmittedActions).toHaveBeenCalledWith(GAME_ID, 3, GameActionType.DISCONNECT);
    expect(waitForActionsComplete).toHaveBeenCalledTimes(2);
    expect(releaseSocket).toHaveBeenCalledTimes(3);
  });
});

describe("SocketGameTestLobbyUtils event operations", () => {
  it("arms leave acceptance and drains the game before clearing socket metadata", async () => {
    const accepted = createDeferred<void>();
    const drained = createDeferred<void>();
    const probe = {
      waitForCount: jest.fn(() => accepted.promise),
      records: jest.fn(() => []),
      dispose: jest.fn()
    };
    const emit = jest.fn();
    const socket = {
      id: "leave-socket",
      gameId: GAME_ID,
      role: PlayerRole.PLAYER,
      connected: true,
      emit
    } as unknown as GameClientSocket;
    const emitAndWaitForEvent = jest.fn(
      async (_socket: GameClientSocket, _event: string, emit: () => void) => {
        emit();
      }
    );
    const waitForActionsComplete = jest.fn(() => drained.promise);
    const createAcceptedActionProbe = jest.fn(() => probe);
    const lobbyUtils = new SocketGameTestLobbyUtils(
      {} as SocketGameTestUserUtils,
      {
        createAcceptedActionProbe,
        emitAndWaitForEvent,
        waitForActionsComplete
      } as unknown as SocketGameTestEventUtils,
      { getGameIdForSocket: async () => GAME_ID }
    );

    const leave = lobbyUtils.leaveGame(socket);

    expect(createAcceptedActionProbe).toHaveBeenCalledWith({
      gameId: GAME_ID,
      actionType: GameActionType.LEAVE,
      socketId: "leave-socket"
    });
    expect(probe.waitForCount).toHaveBeenCalledWith(1);
    expect(probe.waitForCount.mock.invocationCallOrder[0]).toBeLessThan(
      emit.mock.invocationCallOrder[0]
    );
    expect(socket.gameId).toBe(GAME_ID);

    accepted.resolve(undefined);
    await accepted.promise;
    await Promise.resolve();

    expect(waitForActionsComplete).toHaveBeenCalledWith(GAME_ID);
    expect(socket.gameId).toBe(GAME_ID);
    drained.resolve(undefined);

    await expect(leave).resolves.toBeUndefined();
    expect(socket.gameId).toBeUndefined();
    expect(socket.role).toBeUndefined();
    expect(probe.dispose).toHaveBeenCalledTimes(1);
  });

  it("passes the join emit into the armed wait and assigns metadata only after GAME_DATA", async () => {
    const gameData = {} as GameJoinOutputData;
    const deferred = createDeferred<GameJoinOutputData>();
    const socket = {
      id: "join-socket",
      connected: true,
      emit: jest.fn()
    } as unknown as GameClientSocket;
    const emitAndWaitForEvent = jest.fn(
      async (_socket: GameClientSocket, _event: string, emit: () => void) => {
        emit();
        return deferred.promise;
      }
    );
    const lobbyUtils = new SocketGameTestLobbyUtils(
      {} as SocketGameTestUserUtils,
      { emitAndWaitForEvent } as unknown as SocketGameTestEventUtils,
      { getGameIdForSocket: async () => null }
    );

    const join = lobbyUtils.joinSpecificGameWithData(socket, GAME_ID, PlayerRole.PLAYER);

    expect(emitAndWaitForEvent).toHaveBeenCalledWith(
      socket,
      SocketIOGameEvents.GAME_DATA,
      expect.any(Function)
    );
    expect(socket.emit).toHaveBeenCalledWith(SocketIOGameEvents.JOIN, {
      gameId: GAME_ID,
      role: PlayerRole.PLAYER,
      targetSlot: null,
      password: undefined
    });
    expect(socket.gameId).toBeUndefined();
    deferred.resolve(gameData);

    await expect(join).resolves.toBe(gameData);
    expect(socket.gameId).toBe(GAME_ID);
    expect(socket.role).toBe(PlayerRole.PLAYER);
  });

  it("adds expected game, role, slot, and socket context to join wait failures", async () => {
    const socket = {
      id: "join-socket",
      connected: true,
      emit: jest.fn()
    } as unknown as GameClientSocket;
    const eventUtils = {
      emitAndWaitForEvent: jest.fn(async () => {
        throw new Error("transport timeout");
      })
    } as unknown as SocketGameTestEventUtils;
    const lobbyUtils = new SocketGameTestLobbyUtils({} as SocketGameTestUserUtils, eventUtils, {
      getGameIdForSocket: async () => null
    });

    await expect(
      lobbyUtils.joinGameWithSlotAndData(socket, GAME_ID, PlayerRole.SPECTATOR, 3)
    ).rejects.toThrow(
      "Failed to join game game-1 as spectator (slot=3, socketId=join-socket): transport timeout"
    );
  });
});

function createFixture(
  options: {
    readonly drainFailures?: readonly (Error | undefined)[];
    readonly sessionResults?: Readonly<Record<string, string | Error>>;
    readonly disconnectWaitFailure?: Error;
  } = {}
): CleanupFixture {
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
  const releaseSocket = jest.fn();
  const lobbyUtils = new SocketGameTestLobbyUtils(
    { releaseSocket } as unknown as SocketGameTestUserUtils,
    {
      waitForActionsComplete,
      waitForSubmittedActions
    } as unknown as SocketGameTestEventUtils,
    { getGameIdForSocket }
  );

  return {
    gameId: GAME_ID,
    lobbyUtils,
    sockets,
    waitForActionsComplete,
    waitForSubmittedActions,
    getGameIdForSocket,
    releaseSocket
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

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

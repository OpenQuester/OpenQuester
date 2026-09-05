import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { type Express } from "express";
import { User } from "infrastructure/database/models/User";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { io as Client } from "socket.io-client";
import { createHttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { container } from "tsyringe";
import { Repository } from "typeorm";
import { GameClientSocket } from "./SocketIOGameTestUtils";
import { connectSocket } from "tests/e2e/harness/SocketTestWait";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

export class SocketGameTestUserUtils {
  private socketUserDataService = container.resolve(SocketUserDataService);
  private readonly serverUrl: string;
  private _ownedSockets: Set<GameClientSocket> | undefined;
  private socketObserver: ((socket: GameClientSocket) => void) | undefined;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  public get httpClient(): ReturnType<typeof createHttpTestClient> {
    return createHttpTestClient(new URL(this.serverUrl).origin);
  }

  /** Attach the scenario before connection/authentication can produce events. */
  public observeSockets(observer: (socket: GameClientSocket) => void): () => void {
    if (this.socketObserver) throw new Error("A socket scenario observer is already active");
    for (const socket of this.ownedSockets) observer(socket);
    this.socketObserver = observer;
    return () => {
      this.socketObserver = undefined;
    };
  }

  public async createAndLoginUser(
    userRepo: Repository<User>,
    app: Express,
    username: string
  ): Promise<{ user: User; cookie: string }> {
    // Create user
    const user = userRepo.create({
      username,
      email: `${username}@test.com`,
      is_deleted: false,
      created_at: new Date(),
      updated_at: new Date()
    });
    await userRepo.save(user);

    // Login
    const loginRes = await this.httpClient.post("/v1/test/login").send({ userId: user.id });

    if (loginRes.status !== 200) {
      throw new Error(`Failed to login user ${username}: ${JSON.stringify(loginRes.body)}`);
    }

    const cookie = loginRes.headers["set-cookie"];
    if (!cookie || !Array.isArray(cookie)) {
      throw new Error("No cookie received from login response");
    }

    return { user, cookie };
  }

  public async loginExistingUser(app: Express, userId: number): Promise<{ cookie: string }> {
    // Login existing user by ID
    const loginRes = await this.httpClient.post("/v1/test/login").send({ userId });

    if (loginRes.status !== 200) {
      throw new Error(`Failed to login existing user ${userId}: ${JSON.stringify(loginRes.body)}`);
    }

    const cookie = loginRes.headers["set-cookie"];
    if (!cookie || !Array.isArray(cookie)) {
      throw new Error("No cookie received from login response");
    }

    return { cookie };
  }

  public async authenticateSocket(
    app: Express,
    socket: GameClientSocket,
    cookie: string
  ): Promise<void> {
    const authRes = await this.httpClient
      .post("/v1/auth/socket")
      .set("Cookie", cookie)
      .send({ socketId: socket.id });

    if (authRes.status !== 200) {
      throw new Error(`Failed to authenticate socket: ${JSON.stringify(authRes.body)}`);
    }
  }

  public async createGameClient(
    app: Express,
    userRepo: Repository<User>
  ): Promise<{ socket: GameClientSocket; user: User; cookie: string }> {
    const username = `testuser_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const { user, cookie } = await this.createAndLoginUser(userRepo, app, username);

    const socket = Client(this.serverUrl, {
      transports: ["websocket"],
      autoConnect: false,
      reconnection: false
    }) as GameClientSocket;

    await this.connectOwnedSocket(socket, "new-game-user", async () => {
      await this.authenticateSocket(app, socket, cookie);
    });

    return { socket, user, cookie };
  }

  /**
   * Create a new socket connection for an existing user (for reconnection scenarios)
   * This simulates a player disconnecting and reconnecting with the same user account
   */
  public async createSocketForExistingUser(
    app: Express,
    userId: number
  ): Promise<{ socket: GameClientSocket; cookie: string }> {
    const { cookie } = await this.loginExistingUser(app, userId);

    const socket = Client(this.serverUrl, {
      transports: ["websocket"],
      autoConnect: false,
      reconnection: false
    }) as GameClientSocket;

    await this.connectOwnedSocket(socket, `existing-game-user-${userId}`, async () => {
      await this.authenticateSocket(app, socket, cookie);
    });

    return { socket, cookie };
  }

  public async createUnauthenticatedGameClient(): Promise<GameClientSocket> {
    const socket = Client(this.serverUrl, {
      transports: ["websocket"],
      autoConnect: false,
      reconnection: false
    }) as GameClientSocket;

    await this.connectOwnedSocket(socket, "unauthenticated-game-user");

    return socket;
  }

  private async connectOwnedSocket(
    socket: GameClientSocket,
    client: string,
    authenticate?: () => Promise<void>
  ): Promise<void> {
    this.ownedSockets.add(socket);

    try {
      this.socketObserver?.(socket);
      await connectSocket(socket, {
        client,
        namespace: SOCKET_GAME_NAMESPACE,
        serverUrl: this.serverUrl,
        timeoutMs: TEST_TIMEOUTS.SOCKET_CONNECT_TIMEOUT_MS
      });
      await authenticate?.();
    } catch (error) {
      const setupFailure = toError(error);
      const cleanupFailures: Error[] = [];

      try {
        socket.close();
      } catch (cleanupError) {
        cleanupFailures.push(toCleanupError("Socket close", cleanupError));
      }
      try {
        socket.removeAllListeners();
      } catch (cleanupError) {
        cleanupFailures.push(toCleanupError("Socket listener removal", cleanupError));
      }

      if (cleanupFailures.length === 0) {
        this.releaseSocket(socket);
        throw setupFailure;
      }

      throw new AggregateError(
        [setupFailure, ...cleanupFailures],
        `Socket client setup and cleanup failed: ${[setupFailure, ...cleanupFailures]
          .map((failure) => failure.message)
          .join("; ")}`
      );
    }
  }

  public getOwnedSockets(): readonly GameClientSocket[] {
    return [...this.ownedSockets];
  }

  public releaseSocket(socket: GameClientSocket): void {
    this.ownedSockets.delete(socket);
  }

  public async getSocketUserData(socket: GameClientSocket): Promise<SocketRedisUserData | null> {
    if (!socket.id) return null;
    return await this.socketUserDataService.getSocketData(socket.id);
  }

  /**
   * Helper method to get user ID from socket user data
   */
  public async getUserIdFromSocket(socket: GameClientSocket): Promise<number> {
    const socketUserData = await this.getSocketUserData(socket);
    if (!socketUserData?.id) {
      throw new Error(`Cannot get user ID from socket ${socket.id}`);
    }
    return socketUserData.id;
  }

  public async getPlayerUserIdFromSocket(socket: GameClientSocket): Promise<number> {
    return this.getUserIdFromSocket(socket);
  }

  private get ownedSockets(): Set<GameClientSocket> {
    return (this._ownedSockets ??= new Set());
  }
}

function toCleanupError(label: string, error: unknown): Error {
  const cause = toError(error);
  return new Error(`${label} failed: ${cause.message}`, { cause });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

import { type Express } from "express";
import { io as Client } from "socket.io-client";
import request from "supertest";
import { container } from "tsyringe";
import { Repository } from "typeorm";
import { User } from "infrastructure/database/models/User";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { GameClientSocket } from "./SocketIOGameTestUtils";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";

export class SocketGameTestUserUtils {
  private socketUserDataService = container.resolve(SocketUserDataService);
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
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
      updated_at: new Date(),
    });
    await userRepo.save(user);

    // Login
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user.id });

    if (loginRes.status !== 200) {
      throw new Error(
        `Failed to login user ${username}: ${JSON.stringify(loginRes.body)}`
      );
    }

    const cookie = loginRes.headers["set-cookie"];
    if (!cookie || !Array.isArray(cookie)) {
      throw new Error("No cookie received from login response");
    }

    return { user, cookie };
  }

  public async loginExistingUser(
    app: Express,
    userId: number
  ): Promise<{ cookie: string }> {
    // Login existing user by ID
    const loginRes = await request(app).post("/v1/test/login").send({ userId });

    if (loginRes.status !== 200) {
      throw new Error(
        `Failed to login existing user ${userId}: ${JSON.stringify(
          loginRes.body
        )}`
      );
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
    const authRes = await request(app)
      .post("/v1/auth/socket")
      .set("Cookie", cookie)
      .send({ socketId: socket.id });

    if (authRes.status !== 200) {
      throw new Error(
        `Failed to authenticate socket: ${JSON.stringify(authRes.body)}`
      );
    }
  }

  public async createGameClient(
    app: Express,
    userRepo: Repository<User>
  ): Promise<{ socket: GameClientSocket; user: User; cookie: string }> {
    const username = `testuser_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const { user, cookie } = await this.createAndLoginUser(
      userRepo,
      app,
      username
    );

    const socket = Client(this.serverUrl, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: false,
    }) as GameClientSocket;

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("[Socket Debug] Connection timeout after 5000ms"));
      }, 5000);

      socket.on("connect", async () => {
        clearTimeout(timeout);
        try {
          await this.authenticateSocket(app, socket, cookie);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      socket.on("connect_error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
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
      autoConnect: true,
      reconnection: false,
    }) as GameClientSocket;

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("[Socket Debug] Connection timeout after 5000ms"));
      }, 5000);

      socket.on("connect", async () => {
        clearTimeout(timeout);
        try {
          await this.authenticateSocket(app, socket, cookie);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      socket.on("connect_error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    return { socket, cookie };
  }

  public async createUnauthenticatedGameClient(): Promise<GameClientSocket> {
    const socket = Client(this.serverUrl, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: false,
    }) as GameClientSocket;

    // Wait for connection without authentication
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("[Socket Debug] Connection timeout after 5000ms"));
      }, 5000);

      socket.on("connect", () => {
        clearTimeout(timeout);
        resolve();
      });

      socket.on("connect_error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    return socket;
  }

  public async getSocketUserData(
    socket: GameClientSocket
  ): Promise<SocketRedisUserData | null> {
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

  public async getPlayerUserIdFromSocket(
    socket: GameClientSocket
  ): Promise<number> {
    return this.getUserIdFromSocket(socket);
  }
}

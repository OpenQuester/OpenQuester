import { type Express } from "express";
import Redis from "ioredis";
import { Repository } from "typeorm";

import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ChatMessageInputData } from "domain/types/socket/chat/ChatMessageInputData";
import { ChatMessageBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { Logger } from "infrastructure/utils/Logger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import {
  GameClientSocket,
  SocketGameTestUtils,
} from "tests/socket/game/utils/SocketIOGameTestUtils";

describe("Socket Game Chat Tests", () => {
  let testEnv: TestEnvironment;
  let cleanup: (() => Promise<void>) | undefined;
  let app: Express;
  let userRepo: Repository<User>;
  let serverUrl: string;
  let showmanSocket: GameClientSocket;
  let playerSockets: GameClientSocket[];
  let spectatorSockets: GameClientSocket[];
  let utils: SocketGameTestUtils;
  let redisClient: Redis;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    userRepo = testEnv.getDatabase().getRepository(User);
    cleanup = boot.cleanup;
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    utils = new SocketGameTestUtils(serverUrl);
  });

  beforeEach(async () => {
    // Clear Redis before each test
    redisClient = RedisConfig.getClient();
    await redisClient.del(...((await redisClient.keys("*")) ?? []));

    const keys = await redisClient.keys("*");
    if (keys.length > 0) {
      throw new Error(`Redis keys not cleared before test: ${keys}`);
    }

    // 2 players, 2 spectators, 1 showman
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 2);
    showmanSocket = setup.showmanSocket;
    playerSockets = setup.playerSockets;
    spectatorSockets = setup.spectatorSockets;
  });

  afterEach(async () => {
    await utils.disconnectAndCleanup(showmanSocket);
    await Promise.all(
      Array.isArray(playerSockets)
        ? playerSockets.map((socket) => utils.disconnectAndCleanup(socket))
        : [Promise.resolve()]
    );
    await Promise.all(
      Array.isArray(spectatorSockets)
        ? spectatorSockets.map((socket) => utils.disconnectAndCleanup(socket))
        : [Promise.resolve()]
    );
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
      Logger.info("Test environment torn down successfully.");
    } catch (err) {
      Logger.error(`Error during teardown: ${JSON.stringify(err)}`);
    }
  });

  describe("Chat Functionality", () => {
    it("should broadcast chat messages from showman to all participants", async () => {
      const allSockets = [showmanSocket, ...playerSockets, ...spectatorSockets];
      const message = "Hello, everyone!";
      const chatMessage: ChatMessageInputData = { message };

      const receivePromises = allSockets.map((socket) =>
        utils
          .waitForEvent(socket, SocketIOEvents.CHAT_MESSAGE)
          .then((response) => {
            expect(response.message).toBe(message);
            expect(response.user).toBeDefined();
          })
      );

      // Showman sends a chat message
      showmanSocket.emit(SocketIOEvents.CHAT_MESSAGE, chatMessage);
      await Promise.all(receivePromises);
    });

    it("should handle chat messages from players to all participants", async () => {
      const allSockets = [showmanSocket, ...playerSockets, ...spectatorSockets];
      const senderSocket = playerSockets[0]; // Choose one player to send the message
      const message = "Hello from a player!";
      const chatMessage: ChatMessageInputData = { message };

      const receivePromises = allSockets.map((socket) =>
        utils
          .waitForEvent(socket, SocketIOEvents.CHAT_MESSAGE)
          .then((response) => {
            expect(response.message).toBe(message);
            expect(response.user).toBeDefined();
          })
      );

      senderSocket.emit(SocketIOEvents.CHAT_MESSAGE, chatMessage);
      await Promise.all(receivePromises);
    });

    it("should broadcast chat messages from spectators to all participants", async () => {
      const allSockets = [showmanSocket, ...playerSockets, ...spectatorSockets];
      const spectator = spectatorSockets[0];
      const message = "Hello from a spectator!";
      const chatMessage: ChatMessageInputData = { message };

      const receivePromises = allSockets.map((socket) =>
        utils
          .waitForEvent(socket, SocketIOEvents.CHAT_MESSAGE)
          .then((response) => {
            expect(response.message).toBe(message);
            expect(response.user).toBeDefined();
          })
      );

      spectator.emit(SocketIOEvents.CHAT_MESSAGE, chatMessage);
      await Promise.all(receivePromises);
    });

    it("should reject chat messages from users not in a game", async () => {
      const outsider = await utils.createGameClient(app, userRepo);
      const errorPromise = utils.waitForEvent(
        outsider.socket,
        SocketIOEvents.ERROR
      );

      outsider.socket.emit(SocketIOEvents.CHAT_MESSAGE, {
        message: "This should not be sent",
      });

      const errorResult = await errorPromise;
      expect(errorResult).toMatchObject({
        message: expect.any(String),
      });
      await utils.disconnectAndCleanup(outsider.socket);
    });

    it("should reject chat messages after a user leaves the game", async () => {
      const leavingPlayer = playerSockets[0];
      await utils.leaveGame(leavingPlayer);
      const errorPromise = utils.waitForEvent(
        leavingPlayer,
        SocketIOEvents.ERROR
      );

      leavingPlayer.emit(SocketIOEvents.CHAT_MESSAGE, {
        message: "This should not be sent",
      });
      const errorResult = await errorPromise;
      expect(errorResult).toMatchObject({
        message: expect.any(String),
      });
    });

    it("should reject invalid chat payloads", async () => {
      const errorPromise = utils.waitForEvent(
        showmanSocket,
        SocketIOEvents.ERROR
      );
      // Missing message field
      showmanSocket.emit(SocketIOEvents.CHAT_MESSAGE, {});
      const errorResult = await errorPromise;
      expect(errorResult).toMatchObject({
        message: expect.any(String),
      });
    });

    it("should reject chat messages from muted players", async () => {
      // Get a player to mute
      const mutedPlayerSocket = playerSockets[0];

      // Get the game and mute the player
      const gameId = showmanSocket.gameId!;
      const game = await utils.getGameFromGameService(gameId);
      const userData = await utils.getSocketUserData(mutedPlayerSocket);
      if (!userData) {
        throw new Error("User data not found for socket");
      }
      const player = game.getPlayer(userData.id, { fetchDisconnected: false });

      if (player) {
        player.isMuted = true;
        await utils.updateGame(game);
      }

      // Try to send a chat message from the muted player
      const errorPromise = utils.waitForEvent(
        mutedPlayerSocket,
        SocketIOEvents.ERROR
      );

      mutedPlayerSocket.emit(SocketIOEvents.CHAT_MESSAGE, {
        message: "This message should be rejected",
      });

      const errorResult = await errorPromise;
      expect(errorResult).toMatchObject({
        message: expect.stringContaining("muted"),
      });
    });

    it("should retrieve chat history when joining a game", async () => {
      // Send some chat messages first
      const messages = ["First message", "Second message", "Third message"];

      for (const message of messages) {
        showmanSocket.emit(SocketIOEvents.CHAT_MESSAGE, { message });
        await utils.waitForEvent(showmanSocket, SocketIOEvents.CHAT_MESSAGE);
      }

      // Create a new player and join the game
      const newPlayer = await utils.createGameClient(app, userRepo);

      // Join the game and capture the game data directly
      const gameData = await utils.joinSpecificGameWithData(
        newPlayer.socket,
        showmanSocket.gameId!,
        PlayerRole.PLAYER
      );

      expect(gameData.chatMessages).toBeDefined();
      expect(gameData.chatMessages.length).toBe(3);

      await utils.disconnectAndCleanup(newPlayer.socket);
    });

    // TODO Tests moved from SocketIOChatAndCommunicationEdgeCases.test.ts
    describe("Chat Message Edge Cases", () => {
      it.skip("should handle extremely long chat messages", () => {
        // TODO: Test chat with messages exceeding length limits
        // Expected: Should truncate or reject overly long messages
        // Flow:
        // 1. Join game as player
        // 2. Send message exceeding character limit
        // 3. Verify message length validation
        // 4. Verify appropriate handling (truncation/rejection)
      });

      it.skip("should handle malicious script injection in chat", () => {
        // TODO: Test protection against script injection attacks
        // Expected: Should sanitize and prevent script execution
        // Flow:
        // 1. Send chat message with script tags/code
        // 2. Verify message sanitization
        // 3. Verify no script execution on client side
      });

      it.skip("should handle special characters and Unicode in chat", () => {
        // TODO: Test chat with special characters, emojis, Unicode
        // Expected: Should handle Unicode properly
        // Flow:
        // 1. Send messages with various Unicode characters
        // 2. Verify proper encoding/decoding
        // 3. Verify display consistency across clients
      });

      it.skip("should handle chat message flooding", () => {
        // TODO: Test protection against chat spam/flooding (Not implemented)
        // Expected: Should rate limit chat messages
        // Flow:
        // 1. Send large number of messages rapidly
        // 2. Verify rate limiting mechanism
        // 3. Verify spam protection
      });

      it.skip("should handle chat messages from disconnected players", () => {
        // TODO: Test chat behavior when sender disconnects after sending
        // Expected: Should handle gracefully
        // Flow:
        // 1. Send chat message
        // 2. Immediately disconnect sender
        // 3. Verify message delivery to other players
      });

      it("should handle empty or whitespace-only messages", async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { playerSockets } = setup;

        try {
          const playerSocket = playerSockets[0];
          // Empty message test
          playerSocket.on(SocketIOEvents.ERROR, (error: any) => {
            expect(error.message).toBeDefined();
          });
          playerSocket.emit(SocketIOEvents.CHAT_MESSAGE, { message: "" });

          // Test whitespace-only message
          playerSocket.emit(SocketIOEvents.CHAT_MESSAGE, {
            message: "   \t\n  ",
          });
        } finally {
          await utils.cleanupGameClients(setup);
        }
      });

      // Easy Complexity Scenarios (5-7 steps)
      it.skip("Easy: Complex Unicode and internationalization", () => {
        // Complexity: Medium (10 steps)
        // TODO: Test comprehensive Unicode support in chat
        // Expected: Should handle all Unicode characters correctly
        // Flow:
        // 1. Start game with players
        // 2. Send messages with emojis (😀🎮🏆)
        // 3. Send messages with Cyrillic characters (Привет)
        // 4. Send messages with Asian characters (こんにちは, 你好)
        // 5. Send messages with Arabic script (مرحبا)
        // 6. Test mixed-script messages in single message
        // 7. Test message length calculation with Unicode
      });

      it("should handle chat during game pause", async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { showmanSocket, playerSockets } = setup;

        try {
          // Start game
          await utils.startGame(showmanSocket);

          // Pause game
          await utils.pauseGame(showmanSocket);

          // Verify game is paused
          const pausedState = await utils.getGameState(setup.gameId);
          expect(pausedState).toBeDefined();
          expect(pausedState!.isPaused).toBe(true);

          const testMessage = "Chat during pause test";

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Test timeout"));
            }, 5000);

            // Listen for chat message on other player
            playerSockets[1].on(
              SocketIOEvents.CHAT_MESSAGE,
              (data: ChatMessageBroadcastData) => {
                Logger.debug(
                  `Received chat message during pause: ${JSON.stringify(data)}`
                );
                clearTimeout(timeout);
                expect(data.message).toBe(testMessage);
                expect(data.user).toBeDefined();
                expect(data.timestamp).toBeDefined();
                resolve();
              }
            );

            // Send chat message during pause
            playerSockets[0].emit(SocketIOEvents.CHAT_MESSAGE, {
              message: testMessage,
            });
          });
        } finally {
          await utils.cleanupGameClients(setup);
        }
      });
    });

    describe("Chat Permission Edge Cases", () => {
      it.skip("should handle spectator chat restrictions", () => {
        // TODO: Test spectator chat limitations during gameplay
        // TODO: Not implemented. Restrict chat for spectators during questions
        // Expected: Should restrict spectator chat appropriately
        // Flow:
        // 1. Join as spectator
        // 2. Attempt chat during restricted periods
        // 3. Verify appropriate restrictions
      });
    });

    describe("Chat History and Persistence Edge Cases", () => {
      it.skip("should handle chat history limits", () => {
        // TODO: Test chat history size limitations
        // Expected: Should limit history size appropriately
        // Flow:
        // 1. Generate large number of chat messages
        // 2. Verify history size limits
        // 3. Verify oldest messages are removed
      });

      // Easy Complexity Scenarios (5-7 steps)
      it.skip("Easy: Basic chat history retrieval", () => {
        // Complexity: Easy (6 steps)
        // TODO: Test basic chat history functionality
        // Expected: Should provide recent chat history to reconnecting players
        // Flow:
        // 1. Start game and exchange 10 chat messages
        // 2. Player disconnects after message exchange
        // 3. Additional 5 messages sent while player disconnected
        // 4. Player reconnects to game
        // 5. Verify player receives recent chat history
        // 6. Confirm history includes messages sent during disconnection
      });
    });
  });
});

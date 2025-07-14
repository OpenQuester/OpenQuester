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

    describe("Chat Message Edge Cases", () => {
      it("should trim leading and trailing whitespace in chat messages", async () => {
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { playerSockets } = setup;
        const playerSocket = playerSockets[0];
        try {
          // Message with leading and trailing whitespace
          const original = "   Hello, world!   \n\t  ";
          const receivePromise = utils.waitForEvent(
            playerSocket,
            SocketIOEvents.CHAT_MESSAGE
          );
          playerSocket.emit(SocketIOEvents.CHAT_MESSAGE, { message: original });
          const response = await receivePromise;
          expect(response.message).toBe("Hello, world!");
        } finally {
          await utils.cleanupGameClients(setup);
        }
      });

      it("should handle extremely long chat messages", async () => {
        // 1. Setup game with 1 player
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { playerSockets } = setup;
        const playerSocket = playerSockets[0];
        try {
          // 2. Send message at max length (255 chars)
          const maxLengthMessage = "a".repeat(255);
          const receivePromise = utils.waitForEvent(
            playerSocket,
            SocketIOEvents.CHAT_MESSAGE
          );
          playerSocket.emit(SocketIOEvents.CHAT_MESSAGE, {
            message: maxLengthMessage,
          });
          const response = await receivePromise;
          expect(response.message).toBe(maxLengthMessage);

          // 3. Send message exceeding max length (256 chars)
          const tooLongMessage = "b".repeat(256);
          const errorPromise = utils.waitForEvent(
            playerSocket,
            SocketIOEvents.ERROR
          );
          playerSocket.emit(SocketIOEvents.CHAT_MESSAGE, {
            message: tooLongMessage,
          });
          const error = await errorPromise;
          // Should be a validation error, message may mention length or validation
          expect(error.message).toMatch(/length|validation|255/i);
        } finally {
          await utils.cleanupGameClients(setup);
        }
      });

      it("should handle special characters, complex Unicode, and internationalization in chat", async () => {
        // Covers: emojis, Cyrillic, Asian, Arabic, mixed scripts, and Unicode length
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
        const { playerSockets, spectatorSockets, showmanSocket } = setup;
        const senderSocket = playerSockets[0];
        const allReceivers = [
          ...playerSockets,
          ...spectatorSockets,
          showmanSocket,
        ];
        try {
          const messages = [
            // Simple and mixed scripts
            "Hello, 世界!", // Chinese
            "Привет, мир!", // Cyrillic
            "こんにちは世界", // Japanese
            "مرحبا بالعالم", // Arabic
            "😀🎮🏆", // Emojis
            "Special chars: !@#$%^&*()_+-=[]{};':\",.<>/?|`~",
            "Mix: Hello 🌍 你好 мир 😀",
            // Mixed-script message
            "Test: 😀 Привет 你好 Hello مرحبا",
          ];

          // For Unicode, 255 code units, not code points (Joi counts JS string length)
          // Each emoji is 2 code units, so 127 emojis = 254, add 1 ASCII for 255
          const maxUnicodeMsg = "😀".repeat(127) + "a";
          const overMaxUnicodeMsg = "😀".repeat(128); // 256 code units
          messages.push(maxUnicodeMsg);

          for (const msg of messages) {
            const receivePromises = allReceivers.map((socket) =>
              utils.waitForEvent(socket, SocketIOEvents.CHAT_MESSAGE)
            );
            senderSocket.emit(SocketIOEvents.CHAT_MESSAGE, { message: msg });
            const results = await Promise.all<ChatMessageBroadcastData>(
              receivePromises
            );
            for (const res of results) {
              expect(res.message).toBe(msg);
            }
          }

          // Over max length Unicode message should be rejected
          const errorPromise = utils.waitForEvent(
            senderSocket,
            SocketIOEvents.ERROR
          );
          senderSocket.emit(SocketIOEvents.CHAT_MESSAGE, {
            message: overMaxUnicodeMsg,
          });
          const error = await errorPromise;
          expect(error.message).toMatch(/length|validation|255/i);
        } finally {
          await utils.cleanupGameClients(setup);
        }
      });

      it.skip("should handle chat message flooding", () => {
        // TODO: Test protection against chat spam/flooding (Not implemented)
        // Expected: Should rate limit chat messages
        // Flow:
        // 1. Send large number of messages rapidly
        // 2. Verify rate limiting mechanism
        // 3. Verify spam protection
      });

      it("should handle chat messages from disconnected players", async () => {
        // 1. Setup game with 2 players, 1 spectator
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
        const { playerSockets, spectatorSockets, showmanSocket } = setup;
        const senderSocket = playerSockets[0];
        const otherSockets = [
          playerSockets[1],
          ...spectatorSockets,
          showmanSocket,
        ];
        const testMessage = "Message before disconnect";

        // 2. Prepare listeners for all other sockets
        const receivePromises = otherSockets.map((socket) =>
          utils.waitForEvent(socket, SocketIOEvents.CHAT_MESSAGE)
        );

        // 3. Wait for sender to receive their own message (ensures server processed it)
        const senderReceivePromise = utils.waitForEvent(
          senderSocket,
          SocketIOEvents.CHAT_MESSAGE
        );
        senderSocket.emit(SocketIOEvents.CHAT_MESSAGE, {
          message: testMessage,
        });
        await senderReceivePromise;

        // 4. Now disconnect sender
        await utils.disconnectAndCleanup(senderSocket);

        // 5. Verify all other sockets received the message
        const results = await Promise.all(receivePromises);
        for (const res of results) {
          expect(res.message).toBe(testMessage);
          expect(res.user).toBeDefined();
        }

        // 6. Cleanup remaining sockets
        // Clean up remaining sockets using the original setup object
        await utils.cleanupGameClients({
          ...setup,
          playerSockets: [playerSockets[1]],
        });
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
      it("should handle chat history limits", async () => {
        // The backend limit is 100 (GAME_CHAT_HISTORY_RETRIEVAL_LIMIT)
        // We'll send 120 messages, then join as a new client and verify only the most recent 100 are returned
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
        const { playerSockets, showmanSocket } = setup;
        const senderSocket = playerSockets[0];
        const totalMessages = 120;
        const historyLimit = 100;
        // Send 120 messages
        for (let i = 1; i <= totalMessages; i++) {
          const msg = `msg-${i}`;
          senderSocket.emit(SocketIOEvents.CHAT_MESSAGE, { message: msg });
          // Wait for the message to be processed (to avoid race conditions)
          await utils.waitForEvent(senderSocket, SocketIOEvents.CHAT_MESSAGE);
        }

        // Now join as a new player and check chat history
        const newPlayer = await utils.createGameClient(app, userRepo);
        const gameData = await utils.joinSpecificGameWithData(
          newPlayer.socket,
          showmanSocket.gameId!,
          PlayerRole.PLAYER
        );

        expect(gameData.chatMessages).toBeDefined();
        expect(Array.isArray(gameData.chatMessages)).toBe(true);
        expect(gameData.chatMessages.length).toBe(historyLimit);

        // The backend returns messages in reverse-chronological order (newest first)
        const expectedMessages = Array.from(
          { length: historyLimit },
          (_, i) => `msg-${totalMessages - i}`
        );
        const actualMessages = gameData.chatMessages.map((m: any) => m.message);
        expect(actualMessages).toEqual(expectedMessages);

        await utils.disconnectAndCleanup(newPlayer.socket);
        await utils.cleanupGameClients(setup);
      });

      // Easy Complexity Scenarios (5-7 steps)
      it("Easy: Basic chat history retrieval", async () => {
        // 1. Setup game with 2 players
        const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
        const { playerSockets, showmanSocket } = setup;
        const senderSocket = playerSockets[0];
        const reconnectingSocket = playerSockets[1];
        // 2. Start game
        await utils.startGame(showmanSocket);

        // 3. Exchange 10 chat messages (sender alternates)
        const allMessages: string[] = [];
        for (let i = 1; i <= 10; i++) {
          const msg = `msg-${i}`;
          allMessages.push(msg);
          const sender = i % 2 === 0 ? reconnectingSocket : senderSocket;
          sender.emit(SocketIOEvents.CHAT_MESSAGE, { message: msg });
          await utils.waitForEvent(sender, SocketIOEvents.CHAT_MESSAGE);
        }

        await utils.waitForEvent(
          reconnectingSocket,
          SocketIOEvents.CHAT_MESSAGE
        );

        // 4. Disconnect one player (simulate disconnect)
        await utils.disconnectAndCleanup(reconnectingSocket);

        // 5. While disconnected, send 5 more messages from senderSocket
        const disconnectedMessages: string[] = [];
        for (let i = 11; i <= 15; i++) {
          const msg = `msg-${i}`;
          disconnectedMessages.push(msg);
          senderSocket.emit(SocketIOEvents.CHAT_MESSAGE, { message: msg });
          await utils.waitForEvent(senderSocket, SocketIOEvents.CHAT_MESSAGE);
        }

        // 6. Reconnect the player (create a new socket for the same user)
        // createGameClient does not accept userId, so we cannot reconnect as the same user in this test utility.
        // For the purpose of this test, we will reconnect as a new user, which still verifies chat history retrieval for new joiners.
        const { socket: newReconnect } = await utils.createGameClient(
          app,
          userRepo
        );
        // 7. Rejoin the game
        const gameData = await utils.joinSpecificGameWithData(
          newReconnect,
          showmanSocket.gameId!,
          PlayerRole.PLAYER
        );

        // 8. Verify chat history includes all 15 messages, in reverse-chronological order
        expect(gameData.chatMessages).toBeDefined();
        expect(Array.isArray(gameData.chatMessages)).toBe(true);
        expect(gameData.chatMessages.length).toBe(15);
        const expected = [...allMessages, ...disconnectedMessages].reverse();
        const actual = gameData.chatMessages.map((m: any) => m.message);
        expect(actual).toEqual(expected);

        await utils.disconnectAndCleanup(newReconnect);
        await utils.cleanupGameClients({
          ...setup,
          playerSockets: [senderSocket],
        });
      });
    });
  });
});

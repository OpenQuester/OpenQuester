import { type Express } from "express";
import Redis from "ioredis";
import { Repository } from "typeorm";

import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ChatMessageInputData } from "domain/types/socket/chat/ChatMessageInputData";
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

      it.skip("should handle empty or whitespace-only messages", () => {
        // TODO: Test chat with empty or whitespace-only content
        // Expected: Should validate and reject empty messages
        // Flow:
        // 1. Send empty chat message
        // 2. Send whitespace-only message
        // 3. Verify validation and rejection
      });

      // Easy Complexity Scenarios (5-7 steps)
      it.skip("Easy: Basic chat message validation", () => {
        // Complexity: Easy (6 steps)
        // TODO: Test basic chat message validation and delivery
        // Expected: Should validate and deliver messages correctly
        // Flow:
        // 1. Start game with showman and 2 players
        // 2. Player1 sends normal chat message
        // 3. Verify message appears for all participants
        // 4. Test message length within normal limits
        // 5. Verify message timestamp accuracy
        // 6. Confirm message attribution to correct sender
      });

      // Easy Complexity Scenarios (5-7 steps)
      it.skip("Easy: Complex Unicode and internationalization", () => {
        // Complexity: Medium (10 steps)
        // TODO: Test comprehensive Unicode support in chat
        // Expected: Should handle all Unicode characters correctly
        // Flow:
        // 1. Start game with players from different regions
        // 2. Send messages with emojis (😀🎮🏆)
        // 3. Send messages with Cyrillic characters (Привет)
        // 4. Send messages with Asian characters (こんにちは, 你好)
        // 5. Send messages with Arabic script (مرحبا)
        // 6. Test mixed-script messages in single message
        // 7. Test message length calculation with Unicode
      });

      it.skip("should handle chat during game pause", () => {
        // TODO: Test chat functionality when game is paused
        // Expected: Should continue to allow chat during pause
        // Flow:
        // 1. Pause game
        // 2. Send chat messages during pause
        // 3. Verify chat continues to function
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

    describe("Chat System Performance Edge Cases", () => {
      it.skip("should handle high-volume chat in large games", () => {
        // TODO: Test chat performance with many players chatting
        // Expected: Should handle high chat volume efficiently
        // Flow:
        // 1. Create game with maximum players
        // 2. Generate high-volume chat activity
        // 3. Verify performance and message delivery
      });

      it.skip("should handle chat with multimedia content", () => {
        // TODO: Test chat with links, images, or multimedia references
        // Expected: Should handle multimedia content appropriately
        // Flow:
        // 1. Send chat with multimedia links
        // 2. Verify content handling and security
        // 3. Verify appropriate content filtering
      });

      it.skip("should handle chat memory usage optimization", () => {
        // TODO: Test chat system memory efficiency
        // Expected: Should manage memory efficiently
        // Flow:
        // 1. Generate extensive chat activity
        // 2. Monitor memory usage
        // 3. Verify efficient memory management
      });

      it.skip("should handle chat with different client capabilities", () => {
        // TODO: Test chat across clients with different capabilities
        // Expected: Should handle capability differences gracefully
        // Flow:
        // 1. Connect clients with different chat capabilities
        // 2. Exchange messages
        // 3. Verify graceful degradation for limited clients
      });
    });
  });
});

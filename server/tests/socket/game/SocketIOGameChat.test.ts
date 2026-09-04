import { type Express } from "express";
import { container } from "tsyringe";
import { Repository } from "typeorm";

import { UserService } from "application/services/user/UserService";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ChatMessageInputData } from "domain/types/socket/chat/ChatMessageInputData";
import { ChatMessageBroadcastData } from "domain/types/socket/events/SocketEventInterfaces";
import { User } from "infrastructure/database/models/User";
import { GameScenario } from "tests/e2e/scenario/GameScenario";
import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";
import {
  GameClientSocket,
  SocketGameTestUtils
} from "tests/socket/game/utils/SocketIOGameTestUtils";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";

function waitForChatMessageWithText(
  scenario: GameScenario,
  socket: GameClientSocket,
  message: string
): Promise<ChatMessageBroadcastData> {
  return scenario.waitForEventMatching<ChatMessageBroadcastData>(
    socket,
    SocketIOEvents.CHAT_MESSAGE,
    (payload) => payload.message === message,
    TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
  );
}

function sendChatMessageAndWait(
  scenario: GameScenario,
  socket: GameClientSocket,
  message: string
): Promise<ChatMessageBroadcastData> {
  // A socket may still receive an older broadcast; wait for the message sent here.
  const messagePromise = waitForChatMessageWithText(scenario, socket, message);

  scenario.actor(socket).emit(SocketIOEvents.CHAT_MESSAGE, { message });

  return messagePromise;
}

function waitForChatMessagesWithTexts(
  scenario: GameScenario,
  socket: GameClientSocket,
  expectedMessages: readonly string[]
): Promise<ChatMessageBroadcastData[]> {
  return scenario.trackExpectation(
    Promise.all(
      expectedMessages.map((message) => waitForChatMessageWithText(scenario, socket, message))
    ),
    "all expected chat burst messages"
  );
}

describe("Socket Game Chat Tests", () => {
  let suite: SocketGameTestSuite;
  let app: Express;
  let userRepo: Repository<User>;
  let userService: UserService;
  let showmanSocket: GameClientSocket;
  let playerSockets: GameClientSocket[];
  let spectatorSockets: GameClientSocket[];
  let utils: SocketGameTestUtils;

  beforeAll(async () => {
    suite = await SocketGameTestSuite.start();
    app = suite.app;
    userRepo = suite.userRepo;
    userService = container.resolve(UserService);
    utils = suite.utils;
  });

  async function prepareChat(): Promise<void> {
    // 2 players, 2 spectators, 1 showman
    const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 2);
    showmanSocket = setup.showmanSocket;
    playerSockets = setup.playerSockets;
    spectatorSockets = setup.spectatorSockets;
  }

  afterEach(async () => {
    await suite?.reset();
  });

  afterAll(async () => {
    await suite?.stop();
  });

  describe("Chat Functionality", () => {
    it("should broadcast chat messages from showman to all participants", () =>
      suite.scenario(async (scenario) => {
        await prepareChat();
        const allSockets = [showmanSocket, ...playerSockets, ...spectatorSockets];
        const message = "Hello, everyone!";
        const chatMessage: ChatMessageInputData = { message };

        const receivePromises = allSockets.map((socket) =>
          scenario.trackExpectation(
            scenario.waitForEvent(socket, SocketIOEvents.CHAT_MESSAGE).then((response) => {
              expect(response.message).toBe(message);
              expect(response.user).toBeDefined();
            }),
            "validated chat broadcast payload"
          )
        );

        // Showman sends a chat message
        scenario.actor(showmanSocket).emit(SocketIOEvents.CHAT_MESSAGE, chatMessage);
        await Promise.all(receivePromises);
      }));

    it("should handle chat messages from players to all participants", () =>
      suite.scenario(async (scenario) => {
        await prepareChat();
        const allSockets = [showmanSocket, ...playerSockets, ...spectatorSockets];
        const senderSocket = playerSockets[0]; // Choose one player to send the message
        const message = "Hello from a player!";
        const chatMessage: ChatMessageInputData = { message };

        const receivePromises = allSockets.map((socket) =>
          scenario.trackExpectation(
            scenario.waitForEvent(socket, SocketIOEvents.CHAT_MESSAGE).then((response) => {
              expect(response.message).toBe(message);
              expect(response.user).toBeDefined();
            }),
            "validated chat broadcast payload"
          )
        );

        scenario.actor(senderSocket).emit(SocketIOEvents.CHAT_MESSAGE, chatMessage);
        await Promise.all(receivePromises);
      }));

    it("should broadcast chat messages from spectators to all participants", () =>
      suite.scenario(async (scenario) => {
        await prepareChat();
        const allSockets = [showmanSocket, ...playerSockets, ...spectatorSockets];
        const spectator = spectatorSockets[0];
        const message = "Hello from a spectator!";
        const chatMessage: ChatMessageInputData = { message };

        const receivePromises = allSockets.map((socket) =>
          scenario.trackExpectation(
            scenario.waitForEvent(socket, SocketIOEvents.CHAT_MESSAGE).then((response) => {
              expect(response.message).toBe(message);
              expect(response.user).toBeDefined();
            }),
            "validated chat broadcast payload"
          )
        );

        scenario.actor(spectator).emit(SocketIOEvents.CHAT_MESSAGE, chatMessage);
        await Promise.all(receivePromises);
      }));

    it("should reject chat messages from users not in a game", () =>
      suite.scenario(async (scenario) => {
        await prepareChat();
        const outsider = await utils.createGameClient(app, userRepo);
        const errorPromise = scenario.waitForEvent(outsider.socket, SocketIOEvents.ERROR);

        scenario.actor(outsider.socket).emit(SocketIOEvents.CHAT_MESSAGE, {
          message: "This should not be sent"
        });

        const errorResult = await errorPromise;
        expect(errorResult).toMatchObject({
          message: expect.any(String)
        });
      }));

    it("should reject chat messages after a user leaves the game", () =>
      suite.scenario(async (scenario) => {
        await prepareChat();
        const leavingPlayer = playerSockets[0];
        await utils.leaveGame(leavingPlayer);
        const errorPromise = scenario.waitForEvent(leavingPlayer, SocketIOEvents.ERROR);

        scenario.actor(leavingPlayer).emit(SocketIOEvents.CHAT_MESSAGE, {
          message: "This should not be sent"
        });
        const errorResult = await errorPromise;
        expect(errorResult).toMatchObject({
          message: expect.any(String)
        });
      }));

    it("should reject invalid chat payloads", () =>
      suite.scenario(async (scenario) => {
        await prepareChat();
        const errorPromise = scenario.waitForEvent(showmanSocket, SocketIOEvents.ERROR);
        // Missing message field
        scenario.actor(showmanSocket).emit(SocketIOEvents.CHAT_MESSAGE, {});
        const errorResult = await errorPromise;
        expect(errorResult).toMatchObject({
          message: expect.any(String)
        });
      }));

    it("should reject chat messages from muted players", () =>
      suite.scenario(async (scenario) => {
        await prepareChat();
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
        if (!player) {
          throw new Error(`Player ${userData.id} not found in game ${gameId}`);
        }
        player.isMuted = true;
        await utils.updateGame(game);

        // Try to send a chat message from the muted player
        const errorPromise = scenario.waitForEvent(mutedPlayerSocket, SocketIOEvents.ERROR);

        scenario.actor(mutedPlayerSocket).emit(SocketIOEvents.CHAT_MESSAGE, {
          message: "This message should be rejected"
        });

        const errorResult = await errorPromise;
        expect(errorResult).toMatchObject({
          message: expect.stringContaining("muted")
        });
      }));

    it("should reject chat messages from globally muted players across different games", () =>
      suite.scenario(async (scenario) => {
        await prepareChat();
        // Get a player to globally mute
        const mutedPlayerSocket = playerSockets[0];
        const userData = await utils.getSocketUserData(mutedPlayerSocket);
        if (!userData) {
          throw new Error("User data not found for socket");
        }

        // Set global mute on the user (muted for 1 hour)
        const mutedUntil = new Date(Date.now() + 3600000);
        await userService.mute(userData.id, mutedUntil);

        // Try to send a chat message in the current game
        const errorPromise1 = scenario.waitForEvent(mutedPlayerSocket, SocketIOEvents.ERROR);

        scenario.actor(mutedPlayerSocket).emit(SocketIOEvents.CHAT_MESSAGE, {
          message: "This message should be rejected in game 1"
        });

        const errorResult1 = await errorPromise1;
        expect(errorResult1).toMatchObject({
          message: expect.stringContaining("muted")
        });

        // Leave the current game
        await utils.leaveGame(mutedPlayerSocket);

        // Create a new game and try to join
        const setup2 = await utils.setupGameTestEnvironment(userRepo, app, 0, 0);
        // Join the new game with the muted player
        await utils.joinSpecificGame(mutedPlayerSocket, setup2.gameId, PlayerRole.PLAYER);

        // Try to send a chat message in the new game
        const errorPromise2 = scenario.waitForEvent(mutedPlayerSocket, SocketIOEvents.ERROR);

        scenario.actor(mutedPlayerSocket).emit(SocketIOEvents.CHAT_MESSAGE, {
          message: "This message should be rejected in game 2"
        });

        const errorResult2 = await errorPromise2;
        expect(errorResult2).toMatchObject({
          message: expect.stringContaining("muted")
        });
      }));

    it("should allow chat messages after global unmute updates active socket session", () =>
      suite.scenario(async (scenario) => {
        await prepareChat();
        const mutedPlayerSocket = playerSockets[0];
        const userData = await utils.getSocketUserData(mutedPlayerSocket);
        if (!userData) {
          throw new Error("User data not found for socket");
        }

        const mutedUntil = new Date(Date.now() + 3600000);
        await userService.mute(userData.id, mutedUntil);
        await userService.unmute(userData.id);

        const message = "This message should be accepted after unmute";
        const chatMessage = await sendChatMessageAndWait(scenario, mutedPlayerSocket, message);

        expect(chatMessage.message).toBe(message);
      }));

    it("should retrieve chat history when joining a game", () =>
      suite.scenario(async (scenario) => {
        await prepareChat();
        // Send some chat messages first
        const messages = ["First message", "Second message", "Third message"];

        for (const message of messages) {
          await sendChatMessageAndWait(scenario, showmanSocket, message);
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
      }));

    describe("Chat Message Edge Cases", () => {
      it("should trim leading and trailing whitespace in chat messages", () =>
        suite.scenario(async (scenario) => {
          await prepareChat();
          const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
          const { playerSockets } = setup;
          const playerSocket = playerSockets[0];
          // Message with leading and trailing whitespace
          const original = "   Hello, world!   \n\t  ";
          const receivePromise = scenario.waitForEvent(playerSocket, SocketIOEvents.CHAT_MESSAGE);
          scenario.actor(playerSocket).emit(SocketIOEvents.CHAT_MESSAGE, { message: original });
          const response = await receivePromise;
          expect(response.message).toBe("Hello, world!");
        }));

      it("should handle extremely long chat messages", () =>
        suite.scenario(async (scenario) => {
          await prepareChat();
          // 1. Setup game with 1 player
          const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
          const { playerSockets } = setup;
          const playerSocket = playerSockets[0];
          // 2. Send message at max length (255 chars)
          const maxLengthMessage = "a".repeat(255);
          const receivePromise = scenario.waitForEvent(playerSocket, SocketIOEvents.CHAT_MESSAGE);
          scenario.actor(playerSocket).emit(SocketIOEvents.CHAT_MESSAGE, {
            message: maxLengthMessage
          });
          const response = await receivePromise;
          expect(response.message).toBe(maxLengthMessage);

          // 3. Send message exceeding max length (256 chars)
          const tooLongMessage = "b".repeat(256);
          const errorPromise = scenario.waitForEvent(playerSocket, SocketIOEvents.ERROR);
          scenario.actor(playerSocket).emit(SocketIOEvents.CHAT_MESSAGE, {
            message: tooLongMessage
          });
          const error = await errorPromise;
          // Should be a validation error, message may mention length or validation
          expect(error.message).toMatch(/length|validation|255/i);
        }));

      it("should handle special characters, complex Unicode, and internationalization in chat", () =>
        suite.scenario(async (scenario) => {
          await prepareChat();
          // Covers: emojis, Cyrillic, Asian, Arabic, mixed scripts, and Unicode length
          const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
          const { playerSockets, spectatorSockets, showmanSocket } = setup;
          const senderSocket = playerSockets[0];
          const allReceivers = [...playerSockets, ...spectatorSockets, showmanSocket];
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
            "Test: 😀 Привет 你好 Hello مرحبا"
          ];

          // For Unicode, 255 code units, not code points (Joi counts JS string length)
          // Each emoji is 2 code units, so 127 emojis = 254, add 1 ASCII for 255
          const maxUnicodeMsg = "😀".repeat(127) + "a";
          const overMaxUnicodeMsg = "😀".repeat(128); // 256 code units
          messages.push(maxUnicodeMsg);

          for (const msg of messages) {
            const receivePromises = allReceivers.map((socket) =>
              scenario.waitForEvent(socket, SocketIOEvents.CHAT_MESSAGE)
            );
            scenario.actor(senderSocket).emit(SocketIOEvents.CHAT_MESSAGE, { message: msg });
            const results = await Promise.all<ChatMessageBroadcastData>(receivePromises);
            for (const res of results) {
              expect(res.message).toBe(msg);
            }
          }

          // Over max length Unicode message should be rejected
          const errorPromise = scenario.waitForEvent(senderSocket, SocketIOEvents.ERROR);
          scenario.actor(senderSocket).emit(SocketIOEvents.CHAT_MESSAGE, {
            message: overMaxUnicodeMsg
          });
          const error = await errorPromise;
          expect(error.message).toMatch(/length|validation|255/i);
        }));

      it("should deliver rapid chat message bursts without dropping history", () =>
        suite.scenario(async (scenario) => {
          await prepareChat();
          const senderSocket = playerSockets[0];
          const observerSocket = spectatorSockets[0];
          const burstMessages = Array.from(
            { length: 20 },
            (_, index) => `burst-message-${index + 1}`
          );

          const receivedBurstPromise = waitForChatMessagesWithTexts(
            scenario,
            observerSocket,
            burstMessages
          );

          for (const message of burstMessages) {
            scenario.actor(senderSocket).emit(SocketIOEvents.CHAT_MESSAGE, { message });
          }

          const receivedMessages = await receivedBurstPromise;
          const receivedTexts = receivedMessages.map((chatMessage) => chatMessage.message);
          expect(receivedTexts).toHaveLength(burstMessages.length);
          expect(receivedTexts).toEqual(expect.arrayContaining(burstMessages));

          const historyClient = await utils.createGameClient(app, userRepo);
          const gameData = await utils.joinSpecificGameWithData(
            historyClient.socket,
            showmanSocket.gameId!,
            PlayerRole.PLAYER
          );
          const historyTexts = gameData.chatMessages.map((chatMessage) => chatMessage.message);

          expect(historyTexts).toHaveLength(burstMessages.length);
          expect(historyTexts).toEqual(expect.arrayContaining(burstMessages));
        }));

      it("should handle chat messages from disconnected players", () =>
        suite.scenario(async (scenario) => {
          await prepareChat();
          // 1. Setup game with 2 players, 1 spectator
          const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 1);
          const { playerSockets, spectatorSockets, showmanSocket } = setup;
          const senderSocket = playerSockets[0];
          const otherSockets = [playerSockets[1], ...spectatorSockets, showmanSocket];
          const testMessage = "Message before disconnect";

          // 2. Prepare listeners for all other sockets
          const receivePromises = otherSockets.map((socket) =>
            scenario.waitForEvent(socket, SocketIOEvents.CHAT_MESSAGE)
          );

          // 3. Wait for sender to receive their own message (ensures server processed it)
          const senderReceivePromise = scenario.waitForEvent(
            senderSocket,
            SocketIOEvents.CHAT_MESSAGE
          );
          scenario.actor(senderSocket).emit(SocketIOEvents.CHAT_MESSAGE, {
            message: testMessage
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
        }));

      it("should handle empty or whitespace-only messages", () =>
        suite.scenario(async (scenario) => {
          await prepareChat();
          const setup = await utils.setupGameTestEnvironment(userRepo, app, 1, 0);
          const { playerSockets } = setup;

          const playerSocket = playerSockets[0];
          const recipients = [setup.showmanSocket, playerSocket].map((socket) =>
            scenario.actor(socket)
          );
          for (const message of ["", "   \t\n  "]) {
            const afterMessage = scenario.mark();
            const messageError = scenario.waitForEvent<{ message: string }>(
              playerSocket,
              SocketIOEvents.ERROR
            );
            const noBroadcast = scenario.assert.noInboundMany({
              actors: recipients,
              event: SocketIOEvents.CHAT_MESSAGE,
              afterSequence: afterMessage,
              durationMs: 100
            });
            scenario.actor(playerSocket).emit(SocketIOEvents.CHAT_MESSAGE, { message });
            const [error] = await Promise.all([messageError, noBroadcast]);
            expect(error.message).toBeDefined();
          }
        }));

      // Easy Complexity Scenarios (5-7 steps)

      it("should handle chat during game pause", () =>
        suite.scenario(async (scenario) => {
          await prepareChat();
          const setup = await utils.setupGameTestEnvironment(userRepo, app, 2, 0);
          const { showmanSocket, playerSockets } = setup;

          // Start game
          await utils.startGame(showmanSocket);

          // Pause game
          await utils.pauseGame(showmanSocket);

          // Verify game is paused
          const pausedState = await utils.getGameState(setup.gameId);
          expect(pausedState).toBeDefined();
          expect(pausedState!.isPaused).toBe(true);

          const testMessage = "Chat during pause test";

          const chatMessagePromise = waitForChatMessageWithText(
            scenario,
            playerSockets[1],
            testMessage
          );
          scenario.actor(playerSockets[0]).emit(SocketIOEvents.CHAT_MESSAGE, {
            message: testMessage
          });
          const chatMessage = await chatMessagePromise;
          expect(chatMessage.user).toBeDefined();
          expect(chatMessage.timestamp).toBeDefined();
        }));
    });

    describe("Chat Permission Edge Cases", () => {
      it("should handle spectator chat restrictions during player answers", () =>
        suite.scenario(async (scenario) => {
          await prepareChat();
          // Start the game first
          await utils.startGame(showmanSocket);

          const game = await utils.getGameFromGameService(showmanSocket.gameId!);
          if (!game) throw new Error("Game not found");

          // Manually set answeringPlayer to simulate answering state
          game.gameState.answeringPlayer = await utils.getUserIdFromSocket(playerSockets[0]);
          game.setQuestionState(QuestionState.ANSWERING);

          // Update the game state directly in Redis
          await utils.updateGame(game);

          // Now try to send a chat message from a spectator while player is answering
          const spectatorSocket = spectatorSockets[0];
          const errorPromise = scenario.waitForEvent(spectatorSocket, SocketIOEvents.ERROR);

          scenario.actor(spectatorSocket).emit(SocketIOEvents.CHAT_MESSAGE, {
            message: "This should be blocked while player is answering"
          });

          const errorResult = await errorPromise;
          expect(errorResult).toMatchObject({
            message: "Spectators cannot chat while player is answering"
          });

          // Clean up by clearing the answering state
          game.gameState.answeringPlayer = null;
          game.setQuestionState(QuestionState.CHOOSING);
          await utils.updateGame(game);
        }));

      it("should allow spectators to chat when no player is answering", () =>
        suite.scenario(async (scenario) => {
          await prepareChat();
          // Start the game
          await utils.startGame(showmanSocket);

          // Verify game is started
          const gameState = await utils.getGameState(showmanSocket.gameId!);
          expect(gameState).toBeDefined();
          expect(gameState!.questionState).toBe("choosing");

          // In choosing state, no player is answering, so spectators should be able to chat
          const allSockets = [showmanSocket, ...playerSockets, ...spectatorSockets];
          const spectatorSocket = spectatorSockets[0];
          const message = "Spectator chat during choosing state";

          const receivePromises = allSockets.map((socket) =>
            scenario.trackExpectation(
              scenario.waitForEvent(socket, SocketIOEvents.CHAT_MESSAGE).then((response) => {
                expect(response.message).toBe(message);
                expect(response.user).toBeDefined();
              }),
              "validated chat broadcast payload"
            )
          );

          scenario.actor(spectatorSocket).emit(SocketIOEvents.CHAT_MESSAGE, { message });
          await Promise.all(receivePromises);
        }));
    });

    describe("Chat History and Persistence Edge Cases", () => {
      it("should handle chat history limits", () =>
        suite.scenario(async (scenario) => {
          await prepareChat();
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
            // Wait for the message to be processed (to avoid race conditions)
            await sendChatMessageAndWait(scenario, senderSocket, msg);
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
        }));

      // Easy Complexity Scenarios (5-7 steps)
      it("Easy: Basic chat history retrieval", () =>
        suite.scenario(async (scenario) => {
          await prepareChat();
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
            await sendChatMessageAndWait(scenario, sender, msg);
          }

          // 4. Disconnect one player (simulate disconnect)
          await utils.disconnectAndCleanup(reconnectingSocket);

          // 5. While disconnected, send 5 more messages from senderSocket
          const disconnectedMessages: string[] = [];
          for (let i = 11; i <= 15; i++) {
            const msg = `msg-${i}`;
            disconnectedMessages.push(msg);
            await sendChatMessageAndWait(scenario, senderSocket, msg);
          }

          // 6. Reconnect the player (create a new socket for the same user)
          // createGameClient does not accept userId, so we cannot reconnect as the same user in this test utility.
          // For the purpose of this test, we will reconnect as a new user, which still verifies chat history retrieval for new joiners.
          const { socket: newReconnect } = await utils.createGameClient(app, userRepo);
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
          const actual = gameData.chatMessages.map((m) => m.message);
          expect(actual).toEqual(expected);
        }));
    });
  });
});

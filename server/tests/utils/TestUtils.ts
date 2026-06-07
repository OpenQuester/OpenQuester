import { container } from "tsyringe";

import { GameService } from "application/services/game/GameService";
import { GAME_EXPIRATION_WARNING_NAMESPACE } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameJoinOutputData } from "domain/types/socket/events/SocketEventInterfaces";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { type Express } from "express";
import { RedisConfig } from "shared/config/RedisConfig";
import { User } from "infrastructure/database/models/User";
import { Repository } from "typeorm";
import { TEST_TIMEOUTS } from "tests/utils/TestTimeouts";
import {
  GameClientSocket,
  GameTestSetup,
  SocketGameTestUtils
} from "../socket/game/utils/SocketIOGameTestUtils";

export interface FinalRoundGameSetup {
  gameId: string;
  showmanSocket: GameClientSocket;
  playerSockets: GameClientSocket[];
  spectatorSockets: GameClientSocket[];
  showmanUser: User;
  playerUsers: User[];
}

export interface FinalRoundGameOptions {
  playersCount: number;
  playerScores: number[];
}

export class TestUtils {
  private socketGameTestUtils: SocketGameTestUtils;
  private gameService: GameService;
  private userRepo: Repository<User>;
  private app: Express;

  constructor(app: Express, userRepo: Repository<User>, serverUrl: string) {
    this.app = app;
    this.userRepo = userRepo;
    this.socketGameTestUtils = new SocketGameTestUtils(serverUrl);
    this.gameService = container.resolve(GameService);
  }

  /**
   * Setup a game in final round state with specific player scores
   */
  public async setupFinalRoundGame(options: FinalRoundGameOptions): Promise<FinalRoundGameSetup> {
    // Create game environment with final round
    const gameSetup = await this.socketGameTestUtils.setupGameTestEnvironment(
      this.userRepo,
      this.app,
      options.playersCount,
      1, // 1 spectator
      true // include final round
    );

    // Start the game
    await this.socketGameTestUtils.startGame(gameSetup.showmanSocket);

    // Navigate to final round by progressing through regular rounds
    await this.navigateToFinalRound(gameSetup.gameId, gameSetup.showmanSocket);

    // Set player scores
    await this.setPlayerScores(gameSetup.gameId, options.playerScores);

    return {
      gameId: gameSetup.gameId,
      showmanSocket: gameSetup.showmanSocket,
      playerSockets: gameSetup.playerSockets,
      spectatorSockets: gameSetup.spectatorSockets,
      showmanUser: gameSetup.showmanUser,
      playerUsers: gameSetup.playerUsers
    };
  }

  /**
   * Complete theme elimination phase
   */
  public async completeThemeElimination(
    playerSockets: GameClientSocket[],
    gameId: string,
    playerUsers?: User[]
  ): Promise<void> {
    // Get game state to see available themes
    let gameState = await this.getGameState(gameId);
    const themes = gameState.currentRound?.themes || [];

    // Eliminate themes until only one remains
    let eliminatedCount = 0;
    const targetEliminations = themes.length - 1;

    while (eliminatedCount < targetEliminations) {
      // Refresh game state to get current turn info
      gameState = await this.getGameState(gameId);

      // Find next theme to eliminate
      const activeThemes =
        gameState.currentRound?.themes?.filter(
          (theme) => !theme.questions?.some((q) => q.isPlayed)
        ) || [];

      if (activeThemes.length <= 1) break;

      // Simply eliminate the first available theme
      const themeToEliminate = activeThemes[0];

      // Get current turn player from game state
      const currentTurnPlayerId = gameState.currentTurnPlayerId;

      let currentPlayerSocket: GameClientSocket;

      if (!currentTurnPlayerId) {
        // Fallback to first player if no turn player is set
        currentPlayerSocket = playerSockets[0];
      } else {
        // Find the socket for the current turn player
        let foundPlayerSocket: GameClientSocket | null = null;

        if (playerUsers) {
          // Match by user ID if user objects are provided
          const userIndex = playerUsers.findIndex((user) => user.id === currentTurnPlayerId);
          if (userIndex !== -1) {
            foundPlayerSocket = playerSockets[userIndex];
          }
        }

        currentPlayerSocket = foundPlayerSocket || playerSockets[0];
      }

      // Set up listener for the theme elimination response before emitting
      const eliminationPromise = this.waitForEvent(
        currentPlayerSocket,
        SocketIOGameEvents.THEME_ELIMINATE,
        TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
      );

      // Eliminate theme with the correct player
      currentPlayerSocket.emit(SocketIOGameEvents.THEME_ELIMINATE, {
        themeId: themeToEliminate.id
      });

      // Wait for the elimination event to be received before continuing
      await eliminationPromise;

      eliminatedCount++;
    }
  }

  /**
   * Get game state
   */
  public async getGameState(gameId: string): Promise<GameStateDTO> {
    const gameState = await this.socketGameTestUtils.getGameState(gameId);
    if (!gameState) {
      throw new Error(`Game ${gameId} not found`);
    }
    return gameState;
  }

  /**
   * Get game entity
   */
  public async getGameEntity(gameId: string): Promise<Game> {
    return this.socketGameTestUtils.getGameFromGameService(gameId);
  }

  /**
   * Wait for specified time
   */
  private async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wait for a condition to become true, polling at regular intervals.
   * Useful for handling async state transitions that may lag behind socket events.
   *
   * @param condition - Callback that returns true when condition is met
   * @param timeoutMs - Maximum time to wait (default: 1000ms)
   * @param intervalMs - Polling interval (default: 200ms)
   * @returns true if condition was met, false if timeout expired
   */
  public async waitForCondition(
    condition: () => Promise<boolean> | boolean,
    timeoutMs: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS,
    intervalMs: number = TEST_TIMEOUTS.ACTION_QUEUE_POLL_INTERVAL_MS
  ): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const result = await condition();
      if (result) {
        return true;
      }
      await this.wait(intervalMs);
    }
    return false;
  }

  public async waitForEvent<T = any>(
    socket: GameClientSocket,
    event: string,
    timeout: number = TEST_TIMEOUTS.SOCKET_EVENT_WAIT_MS
  ): Promise<T> {
    return this.socketGameTestUtils.waitForEvent(socket, event, timeout);
  }

  /**
   * Expire a timer by reducing its TTL to trigger natural expiration.
   * This simulates timer expiration without waiting for the actual duration.
   * Use this instead of sleep/wait to test timer-based game logic.
   *
   * @param gameId - The game ID for the timer
   * @param keyPattern - Optional pattern for specific timer types (e.g., "media-download")
   */
  public async expireTimer(gameId: string, keyPattern: string = ""): Promise<void> {
    const redisClient = RedisConfig.getClient();
    const timerKey = keyPattern ? `timer:${keyPattern}:${gameId}` : `timer:${gameId}`;
    await redisClient.pexpire(timerKey, 50);
  }

  /**
   * Expire a timer and wait until Redis keyspace handling submits the game action.
   * Prefer this in socket-flow tests so timer assertions are event/action-driven.
   */
  public async expireTimerAndWaitForAction(
    gameId: string,
    actionType?: GameActionType,
    keyPattern: string = "",
    timeout: number = TEST_TIMEOUTS.SOCKET_TIMER_EVENT_WAIT_MS
  ): Promise<void> {
    const timerActionSubmitted = this.socketGameTestUtils.waitForSubmittedActions(
      gameId,
      1,
      actionType,
      timeout
    );

    await this.expireTimer(gameId, keyPattern);
    await timerActionSubmitted;
  }

  /**
   * Expire a game expiration warning key by reducing its TTL.
   *
   * @param gameId - The game ID for the warning key
   * @param waitMs - Time to wait after expiration for event processing (default: 150ms)
   */
  public async expireGameExpirationWarning(
    gameId: string,
    waitMs: number = TEST_TIMEOUTS.REDIS_EXPIRY_WAIT_MS
  ): Promise<void> {
    const redisClient = RedisConfig.getClient();
    const warningKey = `${GAME_EXPIRATION_WARNING_NAMESPACE}:${gameId}`;
    await redisClient.pexpire(warningKey, 50);
    await this.wait(waitMs);
  }

  public async createAndLoginUser(username: string): Promise<{ user: User; cookie: string }> {
    return this.socketGameTestUtils.createAndLoginUser(this.userRepo, this.app, username);
  }

  /**
   * Navigate to final round
   */
  private async navigateToFinalRound(
    gameId: string,
    showmanSocket: GameClientSocket
  ): Promise<void> {
    // Progress through regular rounds using the existing utility
    const game = await this.gameService.getGameEntity(gameId);
    const packageRounds = game.roundIndex;
    const roundsSorted = [...packageRounds].sort((a, b) => a.order - b.order);
    const finalRoundIndex = roundsSorted.findIndex((r) => r.type === PackageRoundType.FINAL);

    if (finalRoundIndex === -1) {
      throw new Error("No final round found in package");
    }

    // Check initial state
    let gameState = await this.getGameState(gameId);

    // If we're already in the final round, no need to progress
    if (this._isFinalRound(gameState)) {
      // Verify we have the expected final round themes
      const themes = gameState.currentRound?.themes || [];
      const finalThemeNames = themes.map((t) => t.name);
      const expectedFinalThemes = themes.some((t) => t.name.includes("Final Theme"));

      if (expectedFinalThemes && themes.length === 3) {
        return;
      } else {
        throw new Error(
          `Expected 3 final round themes but got ${themes.length}: ${finalThemeNames.join(", ")}`
        );
      }
    }

    // We need to navigate to the final round
    // If the final round is at index 0, we have a package structure issue
    if (finalRoundIndex === 0) {
      throw new Error(
        `Invalid package structure: Final round is at index 0, but current round is ${gameState.currentRound?.type}. This suggests a test isolation issue.`
      );
    }

    // Progress through rounds until we reach the final round
    for (let i = 0; i < finalRoundIndex; i++) {
      const nextRoundPromise = this.waitForEvent(showmanSocket, SocketIOGameEvents.NEXT_ROUND);
      await this.socketGameTestUtils.progressToNextRound(showmanSocket);

      // Wait for round transition to complete
      await nextRoundPromise;

      // Check if we've reached the final round
      gameState = await this.getGameState(gameId);

      if (this._isFinalRound(gameState)) {
        break;
      }
    }

    // Verify we actually reached the final round
    const finalGameState = await this.getGameState(gameId);
    const currentRoundType = finalGameState.currentRound?.type;

    if (currentRoundType === PackageRoundType.FINAL) {
      // Verify we have the expected final round themes
      const themes = finalGameState.currentRound?.themes || [];
      const finalThemeNames = themes.map((t) => t.name);
      const expectedFinalThemes = themes.some((t) => t.name.includes("Final Theme"));

      if (expectedFinalThemes && themes.length === 3) {
        // Success!
        return;
      } else {
        throw new Error(
          `Expected 3 final round themes but got ${themes.length}: ${finalThemeNames.join(", ")}`
        );
      }
    } else {
      throw new Error(
        `Failed to navigate to final round. Current round type: ${currentRoundType}, expected: ${PackageRoundType.FINAL}`
      );
    }
  }

  /**
   * Set player scores
   */
  private async setPlayerScores(gameId: string, scores: number[]): Promise<void> {
    const game = await this.gameService.getGameEntity(gameId);
    const players = game.players.filter((p) => p.role === PlayerRole.PLAYER);

    for (let i = 0; i < Math.min(players.length, scores.length); i++) {
      players[i].score = scores[i];
    }

    await this.gameService.updateGame(game);
  }

  private _isFinalRound(gameState: GameStateDTO): boolean {
    return gameState.currentRound?.type === PackageRoundType.FINAL;
  }

  /**
   * Forward method to SocketGameTestUtils for updating game
   */
  public async updateGame(game: Game): Promise<void> {
    return this.socketGameTestUtils.updateGame(game);
  }

  /**
   * Forward method to SocketGameTestUtils for getting game from service
   */
  public async getGameFromGameService(gameId: string): Promise<Game> {
    return this.socketGameTestUtils.getGameFromGameService(gameId);
  }

  /**
   * Forward method to SocketGameTestUtils for creating game client
   */
  public async createGameClient(): Promise<{
    socket: GameClientSocket;
    user: User;
    cookie: string;
  }> {
    return this.socketGameTestUtils.createGameClient(this.app, this.userRepo);
  }

  /**
   * Create a new socket connection for an existing user (for reconnection scenarios)
   * This simulates a player disconnecting and reconnecting with the same user account
   */
  public async createSocketForExistingUser(
    userId: number
  ): Promise<{ socket: GameClientSocket; cookie: string }> {
    return this.socketGameTestUtils.createSocketForExistingUser(this.app, userId);
  }

  /**
   * Forward method to SocketGameTestUtils for joining game
   */
  public async joinGame(socket: GameClientSocket, gameId: string, role: PlayerRole): Promise<void> {
    return this.socketGameTestUtils.joinGame(socket, gameId, role);
  }

  public async joinGameWithData(
    socket: GameClientSocket,
    gameId: string,
    role: PlayerRole
  ): Promise<GameJoinOutputData> {
    return this.socketGameTestUtils.joinSpecificGameWithData(socket, gameId, role);
  }

  /**
   * Forward method to SocketGameTestUtils for disconnecting and cleanup
   */
  public async disconnectAndCleanup(socket: GameClientSocket): Promise<void> {
    return this.socketGameTestUtils.disconnectAndCleanup(socket);
  }

  /**
   * Forward method to SocketGameTestUtils for cleaning up game clients
   */
  public async cleanupGameClients(setup: GameTestSetup): Promise<void> {
    return this.socketGameTestUtils.cleanupGameClients(setup);
  }
}

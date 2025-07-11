import { Container, CONTAINER_TYPES } from "application/Container";
import { GameService } from "application/services/game/GameService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { type Express } from "express";
import { User } from "infrastructure/database/models/User";
import { Repository } from "typeorm";
import {
  GameClientSocket,
  SocketGameTestUtils,
} from "../socket/game/utils/SocketIOGameTestUtils";

export interface FinalRoundGameSetup {
  gameId: string;
  showmanSocket: GameClientSocket;
  playerSockets: GameClientSocket[];
  spectatorSocket: GameClientSocket;
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
    this.gameService = Container.get<GameService>(CONTAINER_TYPES.GameService);
  }

  /**
   * Setup a game in final round state with specific player scores
   */
  public async setupFinalRoundGame(
    options: FinalRoundGameOptions
  ): Promise<FinalRoundGameSetup> {
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
      spectatorSocket: gameSetup.spectatorSockets[0],
      showmanUser: gameSetup.showmanUser,
      playerUsers: gameSetup.playerUsers,
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
      const currentTurnPlayerId = gameState.finalRoundData?.currentTurnPlayerId;

      let currentPlayerSocket: GameClientSocket;

      if (!currentTurnPlayerId) {
        // Fallback to first player if no turn player is set
        currentPlayerSocket = playerSockets[0];
      } else {
        // Find the socket for the current turn player
        let foundPlayerSocket: GameClientSocket | null = null;

        if (playerUsers) {
          // Match by user ID if user objects are provided
          const userIndex = playerUsers.findIndex(
            (user) => user.id === currentTurnPlayerId
          );
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
        5000
      );

      // Eliminate theme with the correct player
      currentPlayerSocket.emit(SocketIOGameEvents.THEME_ELIMINATE, {
        themeId: themeToEliminate.id,
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
   * Wait for specified time
   */
  public async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public async waitForEvent<T = any>(
    socket: GameClientSocket,
    event: string,
    timeout: number = 5000
  ): Promise<T> {
    return this.socketGameTestUtils.waitForEvent(socket, event, timeout);
  }

  /**
   * Emit event and wait for response
   */
  private async emitAndWait(
    socket: GameClientSocket,
    event: string,
    data: any
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Event ${event} timed out`));
      }, 5000);

      socket.emit(event, data, (response: any) => {
        clearTimeout(timeout);
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
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
    const rounds = game.package?.rounds || [];
    const finalRoundIndex = rounds.findIndex(
      (r) => r.type === PackageRoundType.FINAL
    );

    if (finalRoundIndex === -1) {
      throw new Error("No final round found in package");
    }

    // Check initial state
    let gameState = await this.getGameState(gameId);

    // If we're already in the final round, no need to progress
    if (gameState.currentRound?.type === PackageRoundType.FINAL) {
      // Verify we have the expected final round themes
      const themes = gameState.currentRound?.themes || [];
      const finalThemeNames = themes.map((t) => t.name);
      const expectedFinalThemes = themes.some((t) =>
        t.name.includes("Final Theme")
      );

      if (expectedFinalThemes && themes.length === 3) {
        return;
      } else {
        throw new Error(
          `Expected 3 final round themes but got ${
            themes.length
          }: ${finalThemeNames.join(", ")}`
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
      const nextRoundPromise = this.waitForEvent(
        showmanSocket,
        SocketIOGameEvents.NEXT_ROUND
      );
      await this.socketGameTestUtils.progressToNextRound(showmanSocket);

      // Wait for round transition to complete
      await nextRoundPromise;

      // Check if we've reached the final round
      gameState = await this.getGameState(gameId);

      if (gameState.currentRound?.type === PackageRoundType.FINAL) {
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
      const expectedFinalThemes = themes.some((t) =>
        t.name.includes("Final Theme")
      );

      if (expectedFinalThemes && themes.length === 3) {
        // Success!
        return;
      } else {
        throw new Error(
          `Expected 3 final round themes but got ${
            themes.length
          }: ${finalThemeNames.join(", ")}`
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
  private async setPlayerScores(
    gameId: string,
    scores: number[]
  ): Promise<void> {
    const game = await this.gameService.getGameEntity(gameId);
    const players = game.players.filter((p) => p.role === PlayerRole.PLAYER);

    for (let i = 0; i < Math.min(players.length, scores.length); i++) {
      players[i].score = scores[i];
    }

    await this.gameService.updateGame(game);
  }

  /**
   * Start theme elimination phase
   */
  public async startThemeElimination(
    gameId: string,
    showmanSocket: GameClientSocket
  ): Promise<void> {
    // First complete theme elimination to get to bidding phase
    const gameState = await this.getGameState(gameId);
    const themes = gameState.currentRound?.themes || [];

    // Eliminate all themes except one
    for (let i = 0; i < themes.length - 1; i++) {
      const themeToEliminate = themes[i];
      await this.emitAndWait(
        showmanSocket,
        SocketIOGameEvents.THEME_ELIMINATE,
        {
          themeId: themeToEliminate.id,
        }
      );
    }
  }

  /**
   * Place a bid for a player
   */
  public async placeBid(
    gameId: string,
    socket: GameClientSocket,
    bid: number
  ): Promise<void> {
    await this.emitAndWait(socket, SocketIOGameEvents.FINAL_BID_SUBMIT, {
      gameId,
      bid,
    });
  }
}

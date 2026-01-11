import { container } from "tsyringe";
import { GameService } from "application/services/game/GameService";
import { Game } from "domain/entities/game/Game";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateQuestionDTO } from "domain/types/dto/game/state/GameStateQuestionDTO";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";

export class SocketGameTestStateUtils {
  private gameService = container.resolve(GameService);

  public async getGame(gameId: string): Promise<Game> {
    return this.gameService.getGameEntity(gameId);
  }

  public async getGameState(gameId: string): Promise<GameStateDTO | null> {
    const game = await this.gameService.getGameEntity(gameId);
    return game?.gameState ?? null;
  }

  public async updateGame(game: Game): Promise<void> {
    return this.gameService.updateGame(game);
  }

  /**
   * Directly set a player's score in the game entity and persist it.
   */
  public async setPlayerScore(
    gameId: string,
    playerId: number,
    score: number
  ): Promise<void> {
    const game = await this.getGame(gameId);
    const player = game.getPlayer(playerId, { fetchDisconnected: true });
    if (!player) {
      throw new Error(`Player ${playerId} not found in game ${gameId}`);
    }
    player.score = score;
    await this.updateGame(game);
  }

  /**
   * Helper method to check if all players are ready in game state
   */
  public async areAllPlayersReady(gameId: string): Promise<boolean> {
    const game = await this.getGame(gameId);
    return game.isEveryoneReady();
  }

  public async getFirstAvailableQuestionId(gameId: string): Promise<number> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game || !game.gameState.currentRound) {
      throw new Error("Game or current round not found");
    }

    const currentRound = game.gameState.currentRound;

    if (!currentRound.themes || currentRound.themes.length === 0) {
      throw new Error("No themes found in current round");
    }

    // Collect all unplayed questions first (to avoid depending on original insertion order)
    const candidates: Array<{
      id: number;
      order: number;
    }> = [];

    for (const theme of currentRound.themes) {
      if (!theme.questions) continue;
      for (const question of theme.questions) {
        if (question.id && !question.isPlayed) {
          // Some tests rely on picking a SIMPLE question first for speed; ensure order fallback works
          candidates.push({ id: question.id, order: question.order ?? 0 });
        }
      }
    }

    if (candidates.length === 0) {
      throw new Error("No available questions found");
    }

    // Pick the lowest order (stable, deterministic)
    candidates.sort((a, b) => a.order - b.order);
    return candidates[0].id;
  }

  /**
   * Get all available question IDs ordered by their order field
   */
  public async getAllAvailableQuestionIds(gameId: string): Promise<number[]> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game || !game.gameState.currentRound) {
      throw new Error("Game or current round not found");
    }

    const currentRound = game.gameState.currentRound;

    if (!currentRound.themes || currentRound.themes.length === 0) {
      return [];
    }

    const questionIds: Array<{ id: number; order: number }> = [];

    // Collect all unplayed questions with their order
    for (const theme of currentRound.themes) {
      if (theme.questions && theme.questions.length > 0) {
        for (const question of theme.questions) {
          if (question.id && !question.isPlayed) {
            // Get question order from package data
            const questionOrder = this.getQuestionOrderFromPackage(
              game.package,
              question.id
            );
            questionIds.push({ id: question.id, order: questionOrder });
          }
        }
      }
    }

    // Sort by order and return just the IDs
    return questionIds.sort((a, b) => a.order - b.order).map((q) => q.id);
  }

  /**
   * Get question order from package data
   */
  private getQuestionOrderFromPackage(
    packageData: PackageDTO,
    questionId: number
  ): number {
    for (const round of packageData.rounds || []) {
      for (const theme of round.themes || []) {
        for (const question of theme.questions || []) {
          if (question.id === questionId) {
            return question.order || 0;
          }
        }
      }
    }
    return 0; // fallback
  }

  /**
   * Find a question by type in the game state
   * Optimized version that prefetches all question data for better performance
   */
  public async findQuestionByType(
    questionType: PackageQuestionType,
    gameId: string,
    secretTransferType?: PackageQuestionTransferType
  ): Promise<GameStateQuestionDTO | null> {
    // Get the full game to access package data
    const game = await this.gameService.getGameEntity(gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    const gameState = game?.gameState;

    if ((gameState.currentRound?.themes ?? []).length < 1) {
      return null;
    }

    // For Hidden questions, we can use a fast path since they're identifiable by price
    if (questionType === PackageQuestionType.HIDDEN) {
      for (const theme of gameState.currentRound!.themes) {
        if (theme.questions) {
          for (const question of theme.questions) {
            if (!question.isPlayed && question.price === null) {
              return question;
            }
          }
        }
      }
      return null;
    }

    // For other question types, we need to check the package data
    // Build a map of all questions that need to be checked to minimize GameQuestionMapper calls
    const questionsToCheck: Array<{
      question: GameStateQuestionDTO;
      themeId: number;
    }> = [];

    for (const theme of gameState.currentRound!.themes) {
      if (theme.questions) {
        for (const question of theme.questions) {
          if (!question.isPlayed) {
            questionsToCheck.push({ question, themeId: theme.id });
          }
        }
      }
    }

    // Now check each question efficiently
    for (const { question } of questionsToCheck) {
      const questionData = GameQuestionMapper.getQuestionAndTheme(
        game.package,
        gameState.currentRound!.id,
        question.id
      );

      if (!questionData?.question) {
        continue;
      }

      const fullQuestion = questionData.question;

      // Filter by secret transfer type if specified
      if (
        secretTransferType &&
        (questionType !== PackageQuestionType.SECRET ||
          fullQuestion.transferType !== secretTransferType)
      ) {
        continue;
      }

      // Direct type comparison for all question types
      if (fullQuestion.type === questionType) {
        return question;
      }
    }

    return null;
  }

  /**
   * Find all questions by type in the game state
   */
  public async findAllQuestionsByType(
    gameState: GameStateDTO,
    questionType: PackageQuestionType,
    gameId: string
  ): Promise<GameStateQuestionDTO[]> {
    const results: GameStateQuestionDTO[] = [];

    if (!gameState.currentRound?.themes) {
      return results;
    }

    // Get the full game to access package data
    const game = await this.gameService.getGameEntity(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    // For other question types, we need to check the package data
    for (const theme of gameState.currentRound.themes) {
      if (theme.questions) {
        for (const question of theme.questions) {
          if (!question.isPlayed) {
            const questionData = GameQuestionMapper.getQuestionAndTheme(
              game.package,
              gameState.currentRound.id,
              question.id
            );

            if (!questionData?.question) {
              continue;
            }

            const fullQuestion = questionData.question;

            // Direct type comparison for all question types
            if (fullQuestion.type === questionType) {
              results.push(question);
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Get the total number of questions in the current round
   */
  public async getCurrentRoundQuestionCount(gameId: string): Promise<number> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game || !game.gameState.currentRound) {
      throw new Error("Game or current round not found");
    }

    const currentRound = game.gameState.currentRound;

    if (!currentRound.themes || currentRound.themes.length === 0) {
      return 0;
    }

    let totalQuestions = 0;
    for (const theme of currentRound.themes) {
      if (theme.questions) {
        totalQuestions += theme.questions.length;
      }
    }

    return totalQuestions;
  }

  /**
   * Find first hidden question ID for testing
   */
  public async getFirstHiddenQuestionId(gameId: string): Promise<number> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game || !game.gameState.currentRound) {
      throw new Error("Game or current round not found");
    }

    const currentRound = game.gameState.currentRound;

    if (!currentRound.themes || currentRound.themes.length === 0) {
      throw new Error("No themes found in current round");
    }

    // Find first hidden question (price is null and not played)
    for (const theme of currentRound.themes) {
      if (theme.questions && theme.questions.length > 0) {
        for (const question of theme.questions) {
          if (question.id && !question.isPlayed && question.price === null) {
            return question.id;
          }
        }
      }
    }

    throw new Error("No hidden questions found");
  }

  /**
   * Helper method to find a question ID by type from game entity
   * Note: This method relies on the test package structure from PackageUtils
   */
  public async getQuestionIdByType(
    gameId: string,
    questionType: PackageQuestionType
  ): Promise<number> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game || !game.gameState.currentRound) {
      throw new Error("Game or current round not found");
    }

    const currentRound = game.gameState.currentRound;

    if (!currentRound.themes || currentRound.themes.length === 0) {
      throw new Error("No themes found in current round");
    }

    // Based on the test package structure in PackageUtils, questions are ordered:
    // 0: SIMPLE (100), 1: STAKE (200), 2: SECRET (300), 3: NO_RISK (400), 4: HIDDEN (500), 5: CHOICE (300)
    const targetOrder = this.getQuestionOrderByType(questionType);

    // Find question with the target order in the first theme
    const firstTheme = currentRound.themes[0];
    if (firstTheme.questions && firstTheme.questions.length > 0) {
      for (const question of firstTheme.questions) {
        if (
          question.id &&
          question.order === targetOrder &&
          !question.isPlayed
        ) {
          return question.id;
        }
      }
    }

    return -1;
  }

  /**
   * Helper method to get question order by type
   */
  private getQuestionOrderByType(questionType: PackageQuestionType): number {
    switch (questionType) {
      case PackageQuestionType.SIMPLE:
        return 0;
      case PackageQuestionType.STAKE:
        return 1;
      case PackageQuestionType.SECRET:
        return 2;
      case PackageQuestionType.NO_RISK:
        return 3;
      case PackageQuestionType.HIDDEN:
        return 4;
      case PackageQuestionType.CHOICE:
        return 5;
      default:
        throw new Error(`Unsupported question type: ${questionType}`);
    }
  }

  public getQuestionTypeFromPackage(game: Game, questionId: number) {
    if (!game.package?.rounds) return null;

    for (const round of game.package.rounds) {
      for (const theme of round.themes) {
        for (const question of theme.questions) {
          if (question.id === questionId) {
            return question.type;
          }
        }
      }
    }
    return null;
  }
}

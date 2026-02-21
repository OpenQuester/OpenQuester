import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import {
  BaseRoundHandler,
  RoundProgressionOptions,
  RoundProgressionResult,
} from "domain/handlers/socket/round/BaseRoundHandler";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateMapper } from "domain/mappers/GameStateMapper";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalRoundTurnManager } from "domain/utils/FinalRoundTurnManager";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

export class SimpleRoundHandler extends BaseRoundHandler {
  constructor(private readonly packageStore: PackageStore) {
    super(PackageRoundType.SIMPLE);
  }

  public async handleRoundProgression(
    game: Game,
    options: RoundProgressionOptions = {}
  ): Promise<RoundProgressionResult> {
    this.validateGameState(game);
    this.validateRoundProgression(game);

    const { forced = false } = options;

    // If forced (showman skip), always progress regardless of question completion
    if (forced) {
      return this.getProgressionState(game);
    }

    // Natural progression: Check if all questions in current round are played
    if (!this.isAllQuestionsPlayed(game)) {
      return { isGameFinished: false, nextGameState: null };
    }

    // All questions played, get next round or finish game
    return this.getProgressionState(game);
  }

  public validateRoundProgression(game: Game): void {
    this.validateGameState(game);
    GameStateValidator.validateGameInProgress(game);

    // Ensure current round exists
    if (!game.gameState.currentRound) {
      throw new ClientError(ClientResponse.ROUND_CURRENT_ROUND_REQUIRED);
    }
  }

  public getValidQuestionStates(): QuestionState[] {
    return [
      QuestionState.CHOOSING,
      QuestionState.SHOWING,
      QuestionState.ANSWERING,
    ];
  }

  /**
   * Check if all questions in the current round are played
   */
  private isAllQuestionsPlayed(game: Game): boolean {
    if (!game.gameState || !game.gameState.currentRound) {
      return false;
    }

    const { played, all } = GameQuestionMapper.getPlayedAndAllQuestions(
      game.gameState
    );

    return all.length > 0 && played.length === all.length;
  }

  /**
   * Determine next game state: either advance to next round or finish the game.
   * Fetches next round data from PackageStore to build the new GameStateRoundDTO.
   */
  private async getProgressionState(game: Game): Promise<RoundProgressionResult> {
    const nextRoundEntry = game.getNextRound();

    if (!nextRoundEntry) {
      game.finish();
      return { isGameFinished: true, nextGameState: null };
    }

    // Fetch full round data from PackageStore
    const nextRound = await this.packageStore.getRound(
      game.id,
      nextRoundEntry.order
    );

    if (!nextRound) {
      game.finish();
      return { isGameFinished: true, nextGameState: null };
    }

    // Keep password between game state changes
    const currentPassword = game.gameState.password;
    const nextGameState = GameStateMapper.getClearGameState(nextRound);
    nextGameState.password = currentPassword;
    game.gameState = nextGameState;

    this.initializeRoundPlayers(game, nextRound, nextGameState);

    return { isGameFinished: false, nextGameState };
  }

  /**
   * Set up turn player and final round data based on the next round type.
   */
  private initializeRoundPlayers(
    game: Game,
    nextRound: GameStateRoundDTO,
    nextGameState: GameStateDTO
  ): void {
    if (nextRound.type === PackageRoundType.FINAL) {
      const finalRoundData =
        FinalRoundStateManager.initializeFinalRoundData(game);

      finalRoundData.turnOrder =
        FinalRoundTurnManager.initializeTurnOrder(game);

      const currentTurnPlayer = FinalRoundTurnManager.getCurrentTurnPlayer(
        game,
        finalRoundData.turnOrder
      );

      nextGameState.currentTurnPlayerId = currentTurnPlayer ?? undefined;
      FinalRoundStateManager.updateFinalRoundData(game, finalRoundData);
      nextGameState.finalRoundData = finalRoundData;
    } else if (nextRound.type === PackageRoundType.SIMPLE) {
      const inGamePlayers = game.getInGamePlayers();

      if (inGamePlayers.length > 0) {
        let minScore = inGamePlayers[0].score;
        let minPlayers = [inGamePlayers[0]];

        for (let i = 1; i < inGamePlayers.length; i++) {
          const player = inGamePlayers[i];
          if (player.score < minScore) {
            minScore = player.score;
            minPlayers = [player];
          } else if (player.score === minScore) {
            minPlayers.push(player);
          }
        }

        const chosen =
          minPlayers.length === 1
            ? minPlayers[0]
            : minPlayers[Math.floor(Math.random() * minPlayers.length)];

        nextGameState.currentTurnPlayerId = chosen.meta.id;
      } else {
        nextGameState.currentTurnPlayerId = null;
      }
    }
  }
}

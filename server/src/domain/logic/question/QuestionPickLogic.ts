import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { ClientResponse } from "domain/enums/ClientResponse";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ClientError } from "domain/errors/ClientError";
import {
  QuestionPickResult,
  QuestionPickType,
} from "domain/handlers/action/question/QuestionPickActionHandler";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GamePhase, TransitionResult } from "domain/state-machine/types";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageThemeDTO } from "domain/types/dto/package/PackageThemeDTO";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";
import { SecretQuestionPickedBroadcastData } from "domain/types/socket/events/game/SecretQuestionPickedEventPayload";
import { StakeQuestionPickedBroadcastData } from "domain/types/socket/events/game/StakeQuestionPickedEventPayload";
import {
  ChoosingToSecretTransferMutationData,
  ChoosingToStakeBiddingMutationData,
} from "domain/types/socket/transition/choosing";

export interface QuestionPickValidationResult {
  question: PackageQuestionDTO;
  theme: PackageThemeDTO;
}

export interface QuestionPickBuildResultInput {
  question: PackageQuestionDTO;
  game: Game;
  timer: GameStateTimer | null;
  specialQuestionData: SecretQuestionGameData | StakeQuestionGameData | null;
  automaticNominalBid: PlayerBidData | null;
}

/**
 * Logic class for handling question pick processing.
 * Extracts validation and result building from SocketIOQuestionService.handleQuestionPick.
 */
export class QuestionPickLogic {
  /**
   * Validate and get question data for the pick action.
   * Throws ClientError if question not found or already played.
   * @param game Game entity
   * @param questionData Pre-fetched question+theme data from PackageStore
   */
  public static validateQuestionPick(
    game: Game,
    questionData: {
      question: PackageQuestionDTO;
      theme: PackageThemeDTO;
    } | null
  ): QuestionPickValidationResult {
    if (!questionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const { question, theme } = questionData;

    if (GameQuestionMapper.isQuestionPlayed(game, question.id!, theme.id!)) {
      throw new ClientError(ClientResponse.QUESTION_ALREADY_PLAYED);
    }

    return { question, theme };
  }

  /**
   * Process marking question as played and updating current question.
   */
  public static processNormalQuestionPick(
    game: Game,
    question: PackageQuestionDTO,
    themeId: number
  ): void {
    // For normal questions, set currentQuestion immediately
    game.gameState.currentQuestion =
      GameQuestionMapper.mapToSimpleQuestion(question);
    GameQuestionMapper.setQuestionPlayed(game, question.id!, themeId);
  }

  /**
   * Mark question as played for special questions.
   */
  public static markQuestionPlayed(
    game: Game,
    questionId: number,
    themeId: number
  ): void {
    GameQuestionMapper.setQuestionPlayed(game, questionId, themeId);
  }

  /**
   * Reset media download status for all players.
   */
  public static resetMediaDownloadStatus(game: Game): void {
    MediaDownloadLogic.resetAllPlayerStatus(game);
  }

  /**
   * Handle fallback to normal question when special question setup fails.
   */
  public static handleSpecialQuestionFallback(
    game: Game,
    questionType: PackageQuestionType,
    questionData: QuestionPickValidationResult
  ): void {
    if (questionType === PackageQuestionType.SECRET) {
      game.gameState.secretQuestionData = null;
    } else if (questionType === PackageQuestionType.STAKE) {
      game.gameState.stakeQuestionData = null;
    }
    // For normal question fallback, set currentQuestion
    game.gameState.currentQuestion = GameQuestionMapper.mapToSimpleQuestion(
      questionData.question
    );
  }

  public static buildResult(
    game: Game,
    question: PackageQuestionDTO,
    timer: GameStateTimer | null,
    transitionResult: TransitionResult
  ): {
    success: boolean;
    data: QuestionPickResult;
  } {
    const timerDto = timer?.value() ?? undefined;

    switch (transitionResult.toPhase) {
      case GamePhase.SECRET_QUESTION_TRANSFER: {
        const data =
          transitionResult.data as ChoosingToSecretTransferMutationData;

        const secretData: SecretQuestionPickedBroadcastData = {
          pickerPlayerId: data.pickerPlayerId,
          transferType: data.transferType,
          questionId: data.questionId,
        };

        return {
          success: true,
          data: {
            type: QuestionPickType.SECRET,
            gameId: game.id,
            secretData,
          },
        };
      }

      case GamePhase.STAKE_BIDDING: {
        const data =
          transitionResult.data as ChoosingToStakeBiddingMutationData;

        const biddingTimer = transitionResult.timer ?? data.timer ?? timerDto;

        const stakeData: StakeQuestionPickedBroadcastData = {
          pickerPlayerId: data.pickerPlayerId,
          questionId: data.questionId,
          maxPrice: data.maxPrice,
          biddingOrder: data.biddingOrder,
          timer: biddingTimer ?? {
            durationMs: 0,
            elapsedMs: 0,
            startedAt: new Date(),
            resumedAt: null,
          },
        };

        return {
          success: true,
          data: {
            type: QuestionPickType.STAKE,
            gameId: game.id,
            timer: biddingTimer ?? undefined,
            question,
            stakeData,
            automaticNominalBid: data.automaticBid ?? null,
          },
        };
      }

      case GamePhase.MEDIA_DOWNLOADING:
      case GamePhase.SHOWING: {
        if (timerDto) {
          return {
            success: true,
            data: {
              type: QuestionPickType.NORMAL,
              gameId: game.id,
              timer: timerDto,
              question,
            },
          };
        }

        return {
          success: false,
          data: {
            type: QuestionPickType.NORMAL,
            gameId: game.id,
          },
        };
      }

      case GamePhase.ANSWERING: {
        const questionPickType = game.gameState.stakeQuestionData
          ? QuestionPickType.STAKE
          : game.gameState.secretQuestionData
          ? QuestionPickType.SECRET
          : QuestionPickType.NORMAL;

        return {
          success: true,
          data: {
            type: questionPickType,
            gameId: game.id,
          },
        };
      }

      default:
        return {
          success: false,
          data: {
            type: QuestionPickType.NORMAL,
            gameId: game.id,
          },
        };
    }
  }
}

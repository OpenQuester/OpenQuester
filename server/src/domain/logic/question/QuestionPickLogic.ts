import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { ClientResponse } from "domain/enums/ClientResponse";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ClientError } from "domain/errors/ClientError";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageThemeDTO } from "domain/types/dto/package/PackageThemeDTO";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";

export interface QuestionPickValidationResult {
  question: PackageQuestionDTO;
  theme: PackageThemeDTO;
}

export interface QuestionPickResult {
  question: PackageQuestionDTO;
  game: Game;
  timer: GameStateTimer | null;
  specialQuestionData: SecretQuestionGameData | StakeQuestionGameData | null;
  automaticNominalBid: PlayerBidData | null;
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
   */
  public static validateQuestionPick(
    game: Game,
    questionId: number
  ): QuestionPickValidationResult {
    const currentRound = game.gameState.currentRound!;

    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      currentRound.id,
      questionId
    );

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
   * Determine if this is a special question type.
   */
  public static isSpecialQuestion(question: PackageQuestionDTO): boolean {
    return (
      question.type === PackageQuestionType.SECRET ||
      question.type === PackageQuestionType.STAKE
    );
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

  /**
   * Build the result for question pick operation.
   */
  public static buildResult(
    input: QuestionPickBuildResultInput
  ): QuestionPickResult {
    const { question, game, timer, specialQuestionData, automaticNominalBid } =
      input;

    return {
      question,
      game,
      timer,
      specialQuestionData,
      automaticNominalBid,
    };
  }
}

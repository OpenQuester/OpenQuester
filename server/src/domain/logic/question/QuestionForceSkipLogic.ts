import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageThemeDTO } from "domain/types/dto/package/PackageThemeDTO";

/**
 * Logic class for handling question force skip by showman.
 * Marks the current question as played and returns question data.
 */
export class QuestionForceSkipLogic {
  /**
   * Get the question to be skipped based on current game state.
   * Handles normal questions, stake questions, and secret questions.
   * @param questionData Pre-fetched question+theme data from PackageStore
   */
  public static getQuestionToSkip(
    questionData: { question: PackageQuestionDTO; theme: PackageThemeDTO } | null
  ): {
    question: PackageQuestionDTO;
    themeId: number;
  } {
    if (!questionData?.question || !questionData.theme.id) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    return {
      question: questionData.question,
      themeId: questionData.theme.id
    };
  }

  /**
   * Process the force skip: marks question as played.
   */
  public static processForceSkip(game: Game, question: PackageQuestionDTO, themeId: number): void {
    GameQuestionMapper.setQuestionPlayed(game, question.id!, themeId);
  }
}

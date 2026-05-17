import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";

export interface SecretQuestionTransferResult {
  game: Game;
  fromPlayerId: number;
  toPlayerId: number;
  questionId: number;
  timer: GameStateTimer;
  question: PackageQuestionDTO;
}

export interface SecretQuestionTransferBuildResultInput {
  game: Game;
  fromPlayerId: number;
  toPlayerId: number;
  secretData: SecretQuestionGameData;
  timer: GameStateTimer;
  question: PackageQuestionDTO;
}

/**
 * Logic class for handling secret question transfer processing.
 * Extracts business logic from SpecialQuestionService.handleSecretQuestionTransfer.
 */
export class SecretQuestionTransferLogic {
  /**
   * Build the result for secret question transfer.
   */
  public static buildResult(
    input: SecretQuestionTransferBuildResultInput
  ): SecretQuestionTransferResult {
    const { game, fromPlayerId, toPlayerId, secretData, timer, question } = input;

    return {
      game,
      fromPlayerId,
      toPlayerId,
      questionId: secretData.questionId,
      timer,
      question
    };
  }
}

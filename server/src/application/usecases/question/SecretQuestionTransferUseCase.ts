import { SecretQuestionService } from "application/services/question/SecretQuestionService";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { type SecretQuestionTransferResult } from "domain/types/question/SecretQuestionTransferTypes";
import {
  SecretQuestionTransferBroadcastData,
  SecretQuestionTransferInputData,
} from "domain/types/socket/game/SecretQuestionTransferData";

/**
 * Handles secret question transfer.
 *
 * Returns empty broadcasts because the socket handler's `afterBroadcast`
 * must perform personalized per-socket emissions (showman sees full answer,
 * players see filtered data).
 */
export class SecretQuestionTransferUseCase
  implements
    GameActionHandler<
      SecretQuestionTransferInputData,
      SecretQuestionTransferResult
    >
{
  constructor(private readonly secretQuestionService: SecretQuestionService) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<SecretQuestionTransferInputData>
  ): Promise<ActionHandlerResult<SecretQuestionTransferResult>> {
    const result =
      await this.secretQuestionService.handleSecretQuestionTransfer(
        ctx.action.socketId,
        ctx.action.payload
      );

    const { game, fromPlayerId, toPlayerId, questionId, timer, question } =
      result;

    const broadcastData: SecretQuestionTransferBroadcastData = {
      fromPlayerId,
      toPlayerId,
      questionId,
    };

    const resultData: SecretQuestionTransferResult = {
      ...broadcastData,
      gameId: game.id,
      timer: timer?.value() ?? null,
      question: question ?? null,
      roundId: game.gameState.currentRound?.id ?? null,
    };

    return {
      success: true,
      data: resultData,
      mutations: [],
      broadcastGame: game,
    };
  }
}

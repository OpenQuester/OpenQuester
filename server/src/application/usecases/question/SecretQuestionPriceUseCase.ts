import { SecretQuestionService } from "application/services/question/SecretQuestionService";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { type SecretQuestionPriceResult } from "domain/types/question/SecretQuestionTransferTypes";
import { SecretQuestionPriceInputData } from "domain/types/socket/game/SecretQuestionTransferData";

/**
 * Handles the price pick of a customPrice secret question by its receiver.
 *
 * Like the transfer, the question data is emitted per socket by the
 * post-execution hook (showman sees the answer, players don't).
 */
export class SecretQuestionPriceUseCase
  implements GameActionHandler<SecretQuestionPriceInputData, SecretQuestionPriceResult>
{
  constructor(private readonly secretQuestionService: SecretQuestionService) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<SecretQuestionPriceInputData>
  ): Promise<ActionHandlerResult<SecretQuestionPriceResult>> {
    const result = await this.secretQuestionService.handlePriceSelection(
      ctx.game,
      ctx.currentPlayer!,
      ctx.action.payload
    );

    return {
      success: true,
      data: {
        gameId: result.game.id,
        playerId: result.toPlayerId,
        price: result.price!,
        questionId: result.questionId,
        timer: result.timer?.value() ?? null,
        question: result.question
      },
      mutations: [
        DataMutationConverter.saveGameMutation(result.game),
        ...DataMutationConverter.mutationFromTimerMutations(result.timerMutations)
      ],
      broadcastGame: result.game
    };
  }
}

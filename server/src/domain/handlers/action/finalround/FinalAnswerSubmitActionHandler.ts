import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { FinalAnswerLossReason } from "domain/enums/FinalRoundTypes";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
import {
  FinalAnswerSubmitInputData,
  FinalAnswerSubmitOutputData,
  SocketIOFinalAutoLossEventPayload,
  FinalSubmitEndEventData,
} from "domain/types/socket/events/FinalRoundEventData";

/**
 * Stateless action handler for final round answer submission.
 * Extracts business logic from FinalAnswerSubmitEventHandler.
 */
export class FinalAnswerSubmitActionHandler
  implements
    GameActionHandler<FinalAnswerSubmitInputData, FinalAnswerSubmitOutputData>
{
  constructor(private readonly finalRoundService: FinalRoundService) {}

  public async execute(
    action: GameAction<FinalAnswerSubmitInputData>
  ): Promise<GameActionHandlerResult<FinalAnswerSubmitOutputData>> {
    const { game, playerId, isPhaseComplete, isAutoLoss, allReviews } =
      await this.finalRoundService.handleFinalAnswerSubmit(
        createActionContextFromAction(action),
        action.payload.answerText
      );

    const outputData: FinalAnswerSubmitOutputData = { playerId };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        data: outputData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<FinalAnswerSubmitOutputData>,
    ];

    // If this is an auto-loss (empty answer), send auto-loss event
    if (isAutoLoss) {
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_AUTO_LOSS,
        data: {
          playerId,
          reason: FinalAnswerLossReason.EMPTY_ANSWER,
        } satisfies SocketIOFinalAutoLossEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      });
    }

    // If phase complete (all answers submitted), send submit-end event
    if (isPhaseComplete) {
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_SUBMIT_END,
        data: {
          phase: FinalRoundPhase.ANSWERING,
          nextPhase: FinalRoundPhase.REVIEWING,
          allReviews,
        } satisfies FinalSubmitEndEventData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      });
    }

    return { success: true, data: outputData, broadcasts };
  }
}

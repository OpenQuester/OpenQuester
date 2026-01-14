import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
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
  FinalBidSubmitOutputData,
  FinalPhaseCompleteEventData,
  FinalQuestionEventData,
  ThemeEliminateInputData,
  ThemeEliminateOutputData,
} from "domain/types/socket/events/FinalRoundEventData";

/**
 * Stateless action handler for final round theme elimination.
 * Extracts business logic from ThemeEliminateEventHandler.
 */
export class ThemeEliminateActionHandler
  implements
    GameActionHandler<ThemeEliminateInputData, ThemeEliminateOutputData>
{
  constructor(private readonly finalRoundService: FinalRoundService) {}

  public async execute(
    action: GameAction<ThemeEliminateInputData>
  ): Promise<GameActionHandlerResult<ThemeEliminateOutputData>> {
    const result = await this.finalRoundService.handleThemeEliminate(
      createActionContextFromAction(action),
      action.payload.themeId
    );

    // Start with broadcasts from the result (includes THEME_ELIMINATE + transition broadcasts)
    const broadcasts: SocketEventBroadcast[] = [...result.broadcasts];

    // If phase is complete (moved to bidding), handle automatic bidding
    if (result.isPhaseComplete) {
      const biddingPhaseResult =
        await this.finalRoundService.initializeBiddingPhase(result.game.id);

      // Add automatic bid events
      for (const autoBid of biddingPhaseResult.automaticBids) {
        broadcasts.push({
          event: SocketIOGameEvents.FINAL_BID_SUBMIT,
          data: {
            playerId: autoBid.playerId,
            bidAmount: autoBid.bidAmount,
            isAutomatic: true,
          } satisfies FinalBidSubmitOutputData,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
        } satisfies SocketEventBroadcast<FinalBidSubmitOutputData>);
      }

      // If all players auto-bid, emit question data and bidding → answering transition
      if (biddingPhaseResult.questionData) {
        broadcasts.push({
          event: SocketIOGameEvents.FINAL_QUESTION_DATA,
          data: {
            questionData: biddingPhaseResult.questionData,
          } satisfies FinalQuestionEventData,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
        } satisfies SocketEventBroadcast<FinalQuestionEventData>);

        broadcasts.push({
          event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
          data: {
            phase: FinalRoundPhase.BIDDING,
            nextPhase: FinalRoundPhase.ANSWERING,
            timer: biddingPhaseResult.timer,
          } satisfies FinalPhaseCompleteEventData,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
        } satisfies SocketEventBroadcast<FinalPhaseCompleteEventData>);
      }
    }

    return { success: true, data: result.data, broadcasts };
  }
}

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
    const { game, eliminatedBy, themeId, nextPlayerId, isPhaseComplete } =
      await this.finalRoundService.handleThemeEliminate(
        action.socketId,
        action.payload.themeId
      );

    const outputData: ThemeEliminateOutputData = {
      themeId,
      eliminatedBy,
      nextPlayerId,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.THEME_ELIMINATE,
        data: outputData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<ThemeEliminateOutputData>,
    ];

    // If phase is complete (moved to bidding), handle automatic bidding
    if (isPhaseComplete) {
      const biddingPhaseResult =
        await this.finalRoundService.initializeBiddingPhase(game.id);

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
          gameId: game.id,
        } satisfies SocketEventBroadcast<FinalBidSubmitOutputData>);
      }

      // Emit FINAL_PHASE_COMPLETE for theme_elimination → bidding transition
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
        data: {
          phase: FinalRoundPhase.THEME_ELIMINATION,
          nextPhase: FinalRoundPhase.BIDDING,
          timer: biddingPhaseResult.timer,
        } satisfies FinalPhaseCompleteEventData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<FinalPhaseCompleteEventData>);

      // If all players auto-bid, emit question data and bidding → answering transition
      if (biddingPhaseResult.questionData) {
        broadcasts.push({
          event: SocketIOGameEvents.FINAL_QUESTION_DATA,
          data: {
            questionData: biddingPhaseResult.questionData,
          } satisfies FinalQuestionEventData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        } satisfies SocketEventBroadcast<FinalQuestionEventData>);

        broadcasts.push({
          event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
          data: {
            phase: FinalRoundPhase.BIDDING,
            nextPhase: FinalRoundPhase.ANSWERING,
            timer: biddingPhaseResult.timer,
          } satisfies FinalPhaseCompleteEventData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        } satisfies SocketEventBroadcast<FinalPhaseCompleteEventData>);
      }
    }

    return { success: true, data: outputData, broadcasts };
  }
}

import { FinalRoundService } from "application/services/socket/FinalRoundService";
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
  FinalBidSubmitInputData,
  FinalBidSubmitOutputData,
} from "domain/types/socket/events/FinalRoundEventData";

/**
 * Stateless action handler for final round bid submission.
 * Extracts business logic from FinalBidSubmitEventHandler.
 */
export class FinalBidSubmitActionHandler
  implements
    GameActionHandler<FinalBidSubmitInputData, FinalBidSubmitOutputData>
{
  constructor(private readonly finalRoundService: FinalRoundService) {}

  public async execute(
    action: GameAction<FinalBidSubmitInputData>
  ): Promise<GameActionHandlerResult<FinalBidSubmitOutputData>> {
    const { game, playerId, bidAmount, transitionResult } =
      await this.finalRoundService.handleFinalBidSubmit(
        action.socketId,
        action.payload.bid
      );

    const outputData: FinalBidSubmitOutputData = { playerId, bidAmount };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.FINAL_BID_SUBMIT,
        data: outputData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<FinalBidSubmitOutputData>,
    ];

    // If phase transitioned, add transition broadcasts
    if (transitionResult?.success) {
      for (const broadcast of transitionResult.broadcasts) {
        broadcasts.push({
          event: broadcast.event,
          data: broadcast.data,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        });
      }
    }

    return { success: true, data: outputData, broadcasts };
  }
}

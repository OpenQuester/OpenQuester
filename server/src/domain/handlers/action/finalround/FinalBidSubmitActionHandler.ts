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
import { convertBroadcasts } from "domain/utils/BroadcastConverter";

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

    // If phase transitioned, add transition broadcasts (service uses satisfies)
    if (transitionResult?.success) {
      broadcasts.push(...convertBroadcasts(transitionResult.broadcasts));
    }

    return { success: true, data: outputData, broadcasts };
  }
}

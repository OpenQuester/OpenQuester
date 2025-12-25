import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
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
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import {
  StakeBidSubmitInputData,
  StakeBidSubmitOutputData,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import { StakeQuestionWinnerEventData } from "domain/types/socket/events/game/StakeQuestionWinnerEventData";

/**
 * Stateless action handler for stake bid submission.
 */
export class StakeBidSubmitActionHandler
  implements
    GameActionHandler<StakeBidSubmitInputData, StakeBidSubmitOutputData>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {}

  public async execute(
    action: GameAction<StakeBidSubmitInputData>
  ): Promise<GameActionHandlerResult<StakeBidSubmitOutputData>> {
    const {
      game,
      playerId,
      bidAmount,
      bidType,
      isPhaseComplete,
      nextBidderId,
      winnerPlayerId,
      questionData,
      timer,
    } = await this.socketIOQuestionService.handleStakeBidSubmit(
      action.socketId,
      action.payload
    );

    const outputData: StakeBidSubmitOutputData = {
      playerId,
      bidAmount,
      bidType,
      isPhaseComplete,
      nextBidderId,
      timer,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.STAKE_BID_SUBMIT,
        data: outputData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      },
    ];

    // If bidding phase is complete, announce winner and start question
    if (isPhaseComplete && winnerPlayerId && questionData && timer) {
      const finalBid = game.gameState.stakeQuestionData?.highestBid || null;

      broadcasts.push({
        event: SocketIOGameEvents.STAKE_QUESTION_WINNER,
        data: {
          winnerPlayerId,
          finalBid,
        } satisfies StakeQuestionWinnerEventData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      });

      broadcasts.push({
        event: SocketIOGameEvents.QUESTION_DATA,
        data: {
          data: questionData,
          timer,
        } satisfies GameQuestionDataEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      });
    }

    return { success: true, data: outputData, broadcasts };
  }
}

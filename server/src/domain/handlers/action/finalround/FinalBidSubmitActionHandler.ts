import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { FinalBidSubmitLogic } from "domain/logic/final-round/FinalBidSubmitLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import {
  FinalBidSubmitInputData,
  FinalBidSubmitOutputData,
} from "domain/types/socket/events/FinalRoundEventData";

/**
 * Stateless action handler for final round bid submission.
 * Uses prefetched ctx.game and ctx.currentPlayer — no Redis re-fetch.
 */
export class FinalBidSubmitActionHandler
  implements
    GameActionHandler<FinalBidSubmitInputData, FinalBidSubmitOutputData>
{
  constructor(private readonly phaseTransitionRouter: PhaseTransitionRouter) {}

  public async execute(
    ctx: ActionExecutionContext<FinalBidSubmitInputData>
  ): Promise<ActionHandlerResult<FinalBidSubmitOutputData>> {
    const { game, currentPlayer, action } = ctx;

    FinalBidSubmitLogic.validate(game, currentPlayer);

    const normalizedBid = FinalBidSubmitLogic.addBid(
      game,
      currentPlayer.meta.id,
      action.payload.bid
    );

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { playerId: currentPlayer.meta.id, isSystem: false },
    });

    const result = FinalBidSubmitLogic.buildResult({
      game,
      playerId: currentPlayer.meta.id,
      bidAmount: normalizedBid,
      transitionResult,
    });

    const outputData: FinalBidSubmitOutputData = {
      playerId: result.playerId,
      bidAmount: result.bidAmount,
    };

    return {
      success: true,
      data: outputData,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromTimerMutations(
          transitionResult?.timerMutations
        ),
        DataMutationConverter.gameBroadcastMutation(
          game.id,
          SocketIOGameEvents.FINAL_BID_SUBMIT,
          outputData
        ),
        ...DataMutationConverter.mutationFromServiceBroadcasts(
          transitionResult?.success ? transitionResult.broadcasts : undefined,
          game.id
        ),
      ],
      broadcastGame: game,
    };
  }
}

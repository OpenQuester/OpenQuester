import { StakeQuestionService } from "application/services/question/StakeQuestionService";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import {
  StakeBidSubmitInputData,
  StakeBidSubmitOutputData,
} from "domain/types/socket/events/game/StakeQuestionEventData";

/**
 * Stateless action handler for stake bid submission.
 */
export class StakeBidSubmitActionHandler
  implements
    GameActionHandler<StakeBidSubmitInputData, StakeBidSubmitOutputData>
{
  constructor(private readonly stakeQuestionService: StakeQuestionService) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<StakeBidSubmitInputData>
  ): Promise<ActionHandlerResult<StakeBidSubmitOutputData>> {
    const result = await this.stakeQuestionService.handleStakeBidSubmit(
      ctx.action.socketId,
      ctx.action.payload
    );

    return {
      success: true,
      data: result.data,
      mutations: [
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          result.broadcasts
        ),
      ],
      broadcastGame: result.game,
    };
  }
}

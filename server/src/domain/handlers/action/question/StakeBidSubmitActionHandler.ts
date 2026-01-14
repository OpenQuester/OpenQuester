import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  StakeBidSubmitInputData,
  StakeBidSubmitOutputData,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import { StakeQuestionService } from "application/services/question/StakeQuestionService";

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
    action: GameAction<StakeBidSubmitInputData>
  ): Promise<GameActionHandlerResult<StakeBidSubmitOutputData>> {
    const result = await this.stakeQuestionService.handleStakeBidSubmit(
      action.socketId,
      action.payload
    );

    return {
      success: true,
      data: result.data,
      broadcasts: result.broadcasts,
    };
  }
}

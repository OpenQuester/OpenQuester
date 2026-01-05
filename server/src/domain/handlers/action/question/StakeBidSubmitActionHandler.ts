import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
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
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    //
  }

  public async execute(
    action: GameAction<StakeBidSubmitInputData>
  ): Promise<GameActionHandlerResult<StakeBidSubmitOutputData>> {
    const result = await this.socketIOQuestionService.handleStakeBidSubmit(
      createActionContextFromAction(action),
      action.payload
    );

    return {
      success: true,
      data: result.data,
      broadcasts: result.broadcasts,
    };
  }
}

import { PlayerSkipLogic } from "domain/logic/question/PlayerSkipLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionAction } from "domain/types/game/QuestionAction";
import {
  EmptyInputData,
  QuestionUnskipBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";

/**
 * Stateless action handler for player unskipping question.
 */
export class QuestionUnskipActionHandler
  implements GameActionHandler<EmptyInputData, QuestionUnskipBroadcastData>
{
  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<QuestionUnskipBroadcastData>> {
    const { game, currentPlayer } = ctx;

    QuestionActionValidator.validateUnskipAction({
      game,
      currentPlayer,
      action: QuestionAction.PLAYER_SKIP,
    });

    PlayerSkipLogic.processUnskip(game, currentPlayer!);

    const result = PlayerSkipLogic.buildUnskipResult({
      game,
      playerId: currentPlayer!.meta.id,
    });

    return {
      success: true,
      data: result.data,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          result.broadcasts
        ),
      ],
    };
  }
}

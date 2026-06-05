import { AnswerSubmittedLogic } from "domain/logic/question/AnswerSubmittedLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import {
  AnswerSubmittedBroadcastData,
  AnswerSubmittedInputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Handles answer submission.
 *
 * Context-aware: receives prefetched game/player from the executor's
 * IN pipeline and returns pure results — no Redis calls.
 *
 * This is a read-only handler: no game save and no timer mutations.
 */
export class AnswerSubmittedUseCase
  implements
    GameActionHandler<AnswerSubmittedInputData, AnswerSubmittedBroadcastData>
{
  public async execute(
    ctx: ActionExecutionContext<AnswerSubmittedInputData>
  ): Promise<ActionHandlerResult<AnswerSubmittedBroadcastData>> {
    AnswerSubmittedLogic.validate(ctx.game, ctx.currentPlayer);

    const result = AnswerSubmittedLogic.buildResult({
      game: ctx.game,
      answerText: ctx.action.payload.answerText,
    });

    return {
      success: true,
      data: result.data,
      mutations: [
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          result.broadcasts
        ),
      ],
      broadcastGame: ctx.game,
    };
  }
}

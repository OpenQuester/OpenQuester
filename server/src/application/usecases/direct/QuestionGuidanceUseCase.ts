import { ClientResponse } from "domain/enums/ClientResponse";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";

export interface QuestionGuidanceData {
  message: string;
  questionId?: number;
}

/** Non-mutating, showman-only guidance broadcast for explaining question rules. */
export class QuestionGuidanceUseCase implements GameActionHandler<
  QuestionGuidanceData,
  QuestionGuidanceData
> {
  public async execute(
    ctx: ActionExecutionContext<QuestionGuidanceData>
  ): Promise<ActionHandlerResult<QuestionGuidanceData>> {
    if (ctx.currentPlayer?.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ACCESS_DENIED);
    }
    const payload = { ...ctx.action.payload, message: ctx.action.payload.message.trim() };
    return {
      success: true,
      data: payload,
      mutations: [
        DataMutationConverter.gameBroadcastMutation(
          ctx.action.gameId,
          SocketIOEvents.QUESTION_GUIDANCE,
          payload
        )
      ]
    };
  }
}

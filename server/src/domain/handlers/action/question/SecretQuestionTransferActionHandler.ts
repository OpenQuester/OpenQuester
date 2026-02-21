import { SecretQuestionService } from "application/services/question/SecretQuestionService";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import {
  SecretQuestionTransferBroadcastData,
  SecretQuestionTransferInputData,
} from "domain/types/socket/game/SecretQuestionTransferData";

/**
 * Result of secret question transfer action.
 * Contains all data needed for socket handler's afterBroadcast to perform
 * personalized emissions (different question data for showman vs players).
 */
export interface SecretQuestionTransferResult
  extends SecretQuestionTransferBroadcastData {
  gameId: string;
  /** Timer data for question display */
  timer: GameStateTimerDTO | null;
  /** Full question data (socket handler will filter per role) */
  question: PackageQuestionDTO | null;
  /** Round ID for question lookup */
  roundId: number | null;
}

/**
 * Stateless action handler for secret question transfer.
 *
 * **Architecture Note**: This handler does business logic and state mutation.
 * It returns empty broadcasts because the socket handler's `afterBroadcast`
 * must perform personalized per-socket emissions (showman sees full answer,
 * players see filtered data).
 */
export class SecretQuestionTransferActionHandler
  implements
    GameActionHandler<
      SecretQuestionTransferInputData,
      SecretQuestionTransferResult
    >
{
  constructor(private readonly secretQuestionService: SecretQuestionService) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<SecretQuestionTransferInputData>
  ): Promise<ActionHandlerResult<SecretQuestionTransferResult>> {
    const result =
      await this.secretQuestionService.handleSecretQuestionTransfer(
        ctx.action.socketId,
        ctx.action.payload
      );

    const { game, fromPlayerId, toPlayerId, questionId, timer, question } =
      result;

    const broadcastData: SecretQuestionTransferBroadcastData = {
      fromPlayerId,
      toPlayerId,
      questionId,
    };

    const resultData: SecretQuestionTransferResult = {
      ...broadcastData,
      gameId: game.id,
      timer: timer?.value() ?? null,
      question: question ?? null,
      roundId: game.gameState.currentRound?.id ?? null,
    };

    return {
      success: true,
      data: resultData,
      mutations: [],
      broadcastGame: game,
    };
  }
}

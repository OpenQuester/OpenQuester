import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
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
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    //
  }

  public async execute(
    action: GameAction<SecretQuestionTransferInputData>
  ): Promise<GameActionHandlerResult<SecretQuestionTransferResult>> {
    const result =
      await this.socketIOQuestionService.handleSecretQuestionTransfer(
        createActionContextFromAction(action),
        action.payload
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

    // Empty broadcasts - socket handler's afterBroadcast does:
    // 1. SECRET_QUESTION_TRANSFER event to all players
    // 2. Personalized QUESTION_DATA to each socket (role-based filtering)
    const broadcasts: SocketEventBroadcast<unknown>[] = [];

    return {
      success: true,
      data: resultData,
      broadcasts,
    };
  }
}

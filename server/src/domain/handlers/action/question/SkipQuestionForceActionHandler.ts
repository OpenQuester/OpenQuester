import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import {
  EmptyInputData,
  EmptyOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";

/**
 * Stateless action handler for force skipping a question (showman).
 */
export class SkipQuestionForceActionHandler
  implements GameActionHandler<EmptyInputData, EmptyOutputData>
{
  constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator
  ) {}

  public async execute(
    action: GameAction<EmptyInputData>
  ): Promise<GameActionHandlerResult<EmptyOutputData>> {
    const { game, question } =
      await this.socketIOQuestionService.handleQuestionForceSkip(
        action.socketId
      );

    const { isGameFinished, nextGameState } =
      await this.socketIOQuestionService.handleRoundProgression(game);

    const result = await this.gameProgressionCoordinator.processGameProgression(
      {
        game,
        isGameFinished,
        nextGameState,
        questionFinishData: {
          answerFiles: question.answerFiles ?? null,
          answerText: question.answerText ?? null,
          nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
        },
      }
    );

    return {
      success: true,
      data: {},
      broadcasts: result.broadcasts as SocketEventBroadcast<unknown>[],
    };
  }
}

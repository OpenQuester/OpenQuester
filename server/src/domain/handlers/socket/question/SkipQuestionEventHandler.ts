import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  EmptyInputData,
  EmptyOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class SkipQuestionEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  EmptyOutputData
> {
  public constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator,
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.SKIP_QUESTION_FORCE;
  }

  protected async getGameIdForAction(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<string | null> {
    try {
      const gameContext = await this.socketGameContextService.fetchGameContext(
        context.socketId
      );
      return gameContext.game?.id ?? null;
    } catch {
      return null;
    }
  }

  protected async validateInput(
    _data: EmptyInputData
  ): Promise<EmptyInputData> {
    return {};
  }

  protected async authorize(): Promise<void> {
    // Authorization handled in service
  }

  protected async execute(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<EmptyOutputData>> {
    const { game, question } =
      await this.socketIOQuestionService.handleQuestionForceSkip(
        context.socketId
      );
    const { isGameFinished, nextGameState } =
      await this.socketIOQuestionService.handleRoundProgression(game);

    // Assign context variables for logging
    context.gameId = game.id;
    context.userId = context.userId;

    // Use the coordinator to handle game progression
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
      broadcast: result.broadcasts,
    };
  }
}

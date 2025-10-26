import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  EmptyInputData,
  QuestionSkipBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class QuestionSkipEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  QuestionSkipBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.QUESTION_SKIP;
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

  protected override getActionType(): GameActionType {
    return GameActionType.QUESTION_SKIP;
  }

  protected async validateInput(
    _data: EmptyInputData
  ): Promise<EmptyInputData> {
    return {};
  }

  protected async authorize(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled in service - checks if user is a player
  }

  protected async execute(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<QuestionSkipBroadcastData>> {
    const result = await this.socketIOQuestionService.handlePlayerSkip(
      context.socketId
    );
    const { game, playerId } = result;

    // Assign context variables for logging
    context.gameId = game.id;

    const broadcastData: QuestionSkipBroadcastData = { playerId };

    // If player gave up (treated as wrong answer), broadcast ANSWER_RESULT first
    if (result.gaveUp) {
      return {
        success: true,
        data: broadcastData,
        broadcast: [
          {
            event: SocketIOGameEvents.ANSWER_RESULT,
            data: {
              answerResult: result.answerResult,
              timer: result.timer,
            },
            target: SocketBroadcastTarget.GAME,
            gameId: game.id,
          },
        ],
      };
    }

    if (game.haveAllPlayersSkipped()) {
      // All players have skipped, trigger automatic question skip
      const { question, game: updatedGame } =
        await this.socketIOQuestionService.handleAutomaticQuestionSkip(game);

      // Handle round progression after automatic skip using the coordinator
      const { isGameFinished, nextGameState } =
        await this.socketIOQuestionService.handleRoundProgression(updatedGame);

      // Use the progression coordinator to handle the complete flow
      const progressionResult =
        await this.gameProgressionCoordinator.processGameProgression({
          game: updatedGame,
          isGameFinished,
          nextGameState,
          questionFinishData: question
            ? {
                answerFiles: question.answerFiles ?? null,
                answerText: question.answerText ?? null,
                nextTurnPlayerId:
                  updatedGame.gameState.currentTurnPlayerId ?? null,
              }
            : null,
        });

      // Add the question skip broadcast first, then progression broadcasts
      const allBroadcasts = [
        {
          event: SocketIOGameEvents.QUESTION_SKIP,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        },
        ...progressionResult.broadcasts,
      ];

      return {
        success: true,
        data: broadcastData,
        broadcast: allBroadcasts,
      };
    }

    // Normal skip - no additional progression logic needed
    return {
      success: true,
      data: broadcastData,
      broadcast: [
        {
          event: SocketIOGameEvents.QUESTION_SKIP,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        },
      ],
    };
  }
}

import { Socket } from "socket.io";

import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
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
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    super(socket, eventEmitter, logger);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.QUESTION_SKIP;
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
    const { game, playerId } =
      await this.socketIOQuestionService.handlePlayerSkip(this.socket.id);

    // Assign context variables for logging
    context.gameId = game.id;
    context.userId = this.socket.userId;

    const broadcastData: QuestionSkipBroadcastData = {
      playerId,
    };

    if (game.haveAllPlayersSkipped()) {
      // All players have skipped, trigger automatic question skip
      const { question, game: updatedGame } =
        await this.socketIOQuestionService.handleAutomaticQuestionSkip(game);

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
          {
            event: SocketIOGameEvents.QUESTION_FINISH,
            data: {
              answerFiles: question?.answerFiles ?? null,
              answerText: question?.answerText ?? null,
              nextTurnPlayerId:
                updatedGame.gameState.currentTurnPlayerId ?? null,
            },
            target: SocketBroadcastTarget.GAME,
            gameId: game.id,
          },
        ],
      };
    }

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

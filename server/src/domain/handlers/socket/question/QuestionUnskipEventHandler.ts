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
  QuestionUnskipBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class QuestionUnskipEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  QuestionUnskipBroadcastData
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
    return SocketIOGameEvents.QUESTION_UNSKIP;
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
  ): Promise<SocketEventResult<QuestionUnskipBroadcastData>> {
    const { game, playerId } =
      await this.socketIOQuestionService.handlePlayerUnskip(this.socket.id);

    // Assign context variables for logging
    context.gameId = game.id;
    context.userId = this.socket.userId;

    const broadcastData: QuestionUnskipBroadcastData = {
      playerId,
    };

    return {
      success: true,
      data: broadcastData,
      broadcast: [
        {
          event: SocketIOGameEvents.QUESTION_UNSKIP,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        },
      ],
    };
  }
}

import { Socket } from "socket.io";

import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { QuestionPickInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class QuestionPickEventHandler extends BaseSocketEventHandler<
  QuestionPickInputData,
  GameQuestionDataEventPayload
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
    return SocketIOGameEvents.QUESTION_PICK;
  }

  protected async validateInput(
    data: QuestionPickInputData
  ): Promise<QuestionPickInputData> {
    return GameValidator.validatePickQuestion(data);
  }

  protected async authorize(
    _data: QuestionPickInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization happens in the service layer
  }

  protected async execute(
    data: QuestionPickInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<GameQuestionDataEventPayload>> {
    const result = await this.socketIOQuestionService.handleQuestionPick(
      this.socket.id,
      data.questionId
    );

    const { question, game, timer } = result;

    const resultData: GameQuestionDataEventPayload = {
      data: question,
      timer: timer.value()!,
    };

    return {
      success: true,
      data: resultData,
      context: {
        ...context,
        gameId: game.id,
        customData: {
          game: game,
          question: question,
          timer: timer,
        },
      },
    };
  }

  protected async afterBroadcast(
    result: SocketEventResult<GameQuestionDataEventPayload>,
    _context: SocketEventContext
  ): Promise<void> {
    // Handle personalized broadcasting for different player roles
    // Showman gets full question data, players get simplified data

    const { game, question, timer } = result.context?.customData as {
      game: Game;
      question: PackageQuestionDTO;
      timer: GameStateTimer;
    };

    if (!game || !question || !timer) {
      return;
    }

    // Get all sockets in the game
    const sockets = await this.socket.nsp.in(game.id).fetchSockets();
    const socketIds = sockets.map((s) => s.id);

    // Get the broadcast map (different question data for different roles)
    const broadcastMap =
      await this.socketIOQuestionService.getPlayersBroadcastMap(
        socketIds,
        game,
        question
      );

    // Send personalized question data to each socket
    for (const [socketId, questionData] of broadcastMap) {
      const timerValue = timer.value();
      if (timerValue) {
        this.eventEmitter.emitToSocket<GameQuestionDataEventPayload>(
          SocketIOGameEvents.QUESTION_DATA,
          {
            data: questionData,
            timer: timerValue,
          },
          socketId
        );
      }
    }
  }
}

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
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SocketEventEmitter } from "domain/types/socket/EmitTarget";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { SecretQuestionPickedBroadcastData } from "domain/types/socket/events/game/SecretQuestionPickedEventPayload";
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

    // Assign context variables for logging
    context.gameId = result.game.id;
    context.userId = this.socket.userId;

    // Check if this is a secret question
    if (result.isSecretQuestion) {
      // For secret questions, we need to emit a different event
      // Return an empty successful result and handle the secret question event separately
      return {
        success: true,
        data: {
          data: result.question,
          timer: { durationMs: 0, elapsedMs: 0, startedAt: new Date() },
        },
        context: {
          ...context,
          gameId: result.game.id,
          customData: {
            game: result.game,
            isSecretQuestion: true,
            secretQuestionData: result.secretQuestionData,
          },
        },
      };
    }

    // Normal question flow (timer should not be null for non-secret questions)
    if (result.timer) {
      const { question, game } = result;
      const timer = result.timer;

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

    return {
      success: false,
      data: {
        data: result.question,
        timer: { durationMs: 0, elapsedMs: 0, startedAt: new Date() },
      },
      context: {
        ...context,
        gameId: result.game.id,
        customData: {
          game: result.game,
          question: null,
          timer: null,
        },
      },
    };
  }

  protected async afterBroadcast(
    result: SocketEventResult<GameQuestionDataEventPayload>,
    _context: SocketEventContext
  ): Promise<void> {
    const customData = result.context?.customData;

    // Check if this is a secret question
    if (customData?.isSecretQuestion) {
      const secretQuestionData =
        customData.secretQuestionData as SecretQuestionGameData | null;

      const game = customData.game as Game;

      if (secretQuestionData && game) {
        // Emit SECRET_QUESTION_PICKED event instead of regular question data
        const secretEventBroadcastData: SecretQuestionPickedBroadcastData = {
          pickerPlayerId: secretQuestionData.pickerPlayerId,
          transferType: secretQuestionData.transferType,
          questionId: secretQuestionData.questionId,
        };

        // Send to all players in the game
        this.eventEmitter.emit(
          SocketIOGameEvents.SECRET_QUESTION_PICKED,
          secretEventBroadcastData,
          { emitter: SocketEventEmitter.IO, gameId: game.id }
        );
      }
      return;
    }

    // Handle personalized broadcasting for normal questions
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

import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { SocketEventEmitter } from "domain/types/socket/EmitTarget";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import {
  SecretQuestionTransferBroadcastData,
  SecretQuestionTransferInputData,
} from "domain/types/socket/game/SecretQuestionTransferData";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class SecretQuestionTransferEventHandler extends BaseSocketEventHandler<
  SecretQuestionTransferInputData,
  SecretQuestionTransferBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.SECRET_QUESTION_TRANSFER;
  }

  protected async getGameIdForAction(
    _data: SecretQuestionTransferInputData,
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
    return GameActionType.SECRET_QUESTION_TRANSFER;
  }

  protected async validateInput(
    data: SecretQuestionTransferInputData
  ): Promise<SecretQuestionTransferInputData> {
    return GameValidator.validateSecretQuestionTransfer(data);
  }

  protected async authorize(
    _data: SecretQuestionTransferInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled in service layer
  }

  protected async execute(
    data: SecretQuestionTransferInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<SecretQuestionTransferBroadcastData>> {
    const result =
      await this.socketIOQuestionService.handleSecretQuestionTransfer(
        context.socketId,
        data
      );

    const broadcastData: SecretQuestionTransferBroadcastData = {
      fromPlayerId: result.fromPlayerId,
      toPlayerId: result.toPlayerId,
      questionId: result.questionId,
    };

    return {
      success: true,
      data: broadcastData,
      context: {
        ...context,
        gameId: result.game.id,
        customData: {
          game: result.game,
          timer: result.timer,
        },
      },
    };
  }

  protected async afterBroadcast(
    result: SocketEventResult<SecretQuestionTransferBroadcastData>,
    _context: SocketEventContext
  ): Promise<void> {
    // First emit the transfer event to all players in the game
    const game = result.context?.customData?.game as Game;
    if (game && result.data) {
      this.eventEmitter.emit(
        SocketIOGameEvents.SECRET_QUESTION_TRANSFER,
        result.data,
        { emitter: SocketEventEmitter.IO, gameId: game.id }
      );
    }

    // After broadcasting the transfer, send question data to all players
    const { timer } = result.context?.customData as {
      game: Game;
      timer: GameStateTimer;
    };

    if (!game || !timer) {
      return;
    }

    // Get full question from the package (not from game state, which only has SimplePackageQuestionDTO)
    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      game.gameState.currentRound!.id,
      game.gameState.currentQuestion!.id!
    );

    if (!questionData) {
      return;
    }

    const currentQuestion = questionData.question;

    // Get all sockets in the game for personalized question data
    const sockets = await this.socket.nsp.in(game.id).fetchSockets();
    const socketIds = sockets.map((s) => s.id);

    // Get the broadcast map (different question data for different roles)
    const broadcastMap =
      await this.socketIOQuestionService.getPlayersBroadcastMap(
        socketIds,
        game,
        currentQuestion
      );

    // Send personalized question data to each socket
    const timerValue = timer.value();
    if (timerValue) {
      for (const [socketId, questionData] of broadcastMap) {
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

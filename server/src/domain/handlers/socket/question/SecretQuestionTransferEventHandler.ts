import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { SecretQuestionTransferResult } from "domain/handlers/action/question/SecretQuestionTransferActionHandler";
import {
  BaseSocketEventHandler,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
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
  SecretQuestionTransferResult
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

  /**
   * Handle broadcasts after action execution.
   *
   * Performs personalized per-socket broadcasts (showman sees full answer,
   * players see filtered data).
   */
  protected override async afterBroadcast(
    result: SocketEventResult<SecretQuestionTransferResult>,
    context: SocketEventContext
  ): Promise<void> {
    const actionResult = result.data;
    if (!actionResult) return;

    const { gameId, timer, question, fromPlayerId, toPlayerId, questionId } =
      actionResult;

    // First emit the transfer event to all players
    const transferBroadcastData: SecretQuestionTransferBroadcastData = {
      fromPlayerId,
      toPlayerId,
      questionId,
    };

    this.eventEmitter.emit(
      SocketIOGameEvents.SECRET_QUESTION_TRANSFER,
      transferBroadcastData,
      { emitter: SocketEventEmitter.IO, gameId }
    );

    // Then send personalized question data if available
    if (!timer || !question) {
      return;
    }

    // Fetch game for role-based broadcast mapping
    const gameContext = await this.socketGameContextService.fetchGameContext(
      context.socketId
    );
    const game = gameContext.game;
    if (!game) return;

    // Get all sockets in the game room
    const sockets = await this.socket.nsp.in(gameId).fetchSockets();
    const socketIds = sockets.map((s) => s.id);

    // Get personalized question data per socket (showman sees full, players see filtered)
    const broadcastMap =
      await this.socketIOQuestionService.getPlayersBroadcastMap(
        socketIds,
        game,
        question
      );

    // Send personalized question data to each socket
    for (const [socketId, questionData] of broadcastMap) {
      this.eventEmitter.emitToSocket<GameQuestionDataEventPayload>(
        SocketIOGameEvents.QUESTION_DATA,
        {
          data: questionData,
          timer: timer,
        },
        socketId
      );
    }
  }
}

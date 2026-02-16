import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  QuestionPickResult,
  QuestionPickType,
} from "domain/handlers/action/question/QuestionPickActionHandler";
import {
  BaseSocketEventHandler,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { QuestionPickInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class QuestionPickEventHandler extends BaseSocketEventHandler<
  QuestionPickInputData,
  QuestionPickResult
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
    return SocketIOGameEvents.QUESTION_PICK;
  }

  protected async getGameIdForAction(
    _data: QuestionPickInputData,
    context: SocketEventContext
  ): Promise<string | null> {
    return this.socketGameContextService.getGameIdForSocket(context.socketId);
  }

  protected override getActionType(): GameActionType {
    return GameActionType.QUESTION_PICK;
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

  /**
   * Handle broadcasts after action execution.
   *
   * For NORMAL questions, performs personalized per-socket broadcasts
   * (showman sees full answer, players see filtered data).
   *
   * Secret and stake questions are already broadcast by the action handler.
   */
  protected override async afterBroadcast(
    result: SocketEventResult<QuestionPickResult>,
    context: SocketEventContext
  ): Promise<void> {
    const actionResult = result.data;
    if (!actionResult) return;

    const { type, gameId, question, timer } = actionResult;

    // Secret and stake questions are already broadcast by action handler
    // Only normal questions need personalized broadcasts here
    if (type !== QuestionPickType.NORMAL || !question || !timer) {
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
          questionEligiblePlayers: game.getQuestionEligiblePlayers(),
        },
        socketId
      );
    }
  }
}

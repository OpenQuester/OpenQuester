import { Socket } from "socket.io";

import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { BaseSocketEventHandler } from "domain/handlers/socket/BaseSocketEventHandler";
import { JoinGameEventHandler } from "domain/handlers/socket/game/JoinGameEventHandler";
import { LeaveGameEventHandler } from "domain/handlers/socket/game/LeaveGameEventHandler";
import { NextRoundEventHandler } from "domain/handlers/socket/game/NextRoundEventHandler";
import { PauseGameEventHandler } from "domain/handlers/socket/game/PauseGameEventHandler";
import { StartGameEventHandler } from "domain/handlers/socket/game/StartGameEventHandler";
import { UnpauseGameEventHandler } from "domain/handlers/socket/game/UnpauseGameEventHandler";
import { AnswerResultEventHandler } from "domain/handlers/socket/question/AnswerResultEventHandler";
import { AnswerSubmittedEventHandler } from "domain/handlers/socket/question/AnswerSubmittedEventHandler";
import { QuestionAnswerEventHandler } from "domain/handlers/socket/question/QuestionAnswerEventHandler";
import { QuestionPickEventHandler } from "domain/handlers/socket/question/QuestionPickEventHandler";
import { SkipQuestionEventHandler } from "domain/handlers/socket/question/SkipQuestionEventHandler";
import { ChatMessageEventHandler } from "domain/handlers/socket/system/ChatMessageEventHandler";
import { DisconnectEventHandler } from "domain/handlers/socket/system/DisconnectEventHandler";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

/**
 * Factory for creating socket event handlers with proper dependency injection
 */
export class SocketEventHandlerFactory {
  constructor(
    private readonly socketIOGameService: SocketIOGameService,
    private readonly socketIOChatService: SocketIOChatService,
    private readonly socketUserDataService: SocketUserDataService,
    private readonly socketIOQuestionService?: SocketIOQuestionService
  ) {}

  /**
   * Create all available game event handlers
   */
  public createGameHandlers(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter
  ): BaseSocketEventHandler[] {
    return [
      new JoinGameEventHandler(
        socket,
        eventEmitter,
        this.socketIOGameService,
        this.socketIOChatService,
        this.socketUserDataService
      ),
      new LeaveGameEventHandler(socket, eventEmitter, this.socketIOGameService),
      new StartGameEventHandler(socket, eventEmitter, this.socketIOGameService),
      new NextRoundEventHandler(socket, eventEmitter, this.socketIOGameService),
      new PauseGameEventHandler(socket, eventEmitter, this.socketIOGameService),
      new UnpauseGameEventHandler(
        socket,
        eventEmitter,
        this.socketIOGameService
      ),
    ];
  }

  /**
   * Create system event handlers (disconnect, chat)
   */
  public createSystemHandlers(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter
  ): BaseSocketEventHandler[] {
    return [
      new DisconnectEventHandler(
        socket,
        eventEmitter,
        this.socketIOGameService
      ),
      new ChatMessageEventHandler(
        socket,
        eventEmitter,
        this.socketIOChatService
      ),
    ];
  }

  /**
   * Create question-related handlers (requires question service)
   */
  public createQuestionHandlers(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter
  ): BaseSocketEventHandler[] {
    if (!this.socketIOQuestionService) {
      return [];
    }

    return [
      new QuestionPickEventHandler(
        socket,
        eventEmitter,
        this.socketIOQuestionService
      ),
      new QuestionAnswerEventHandler(
        socket,
        eventEmitter,
        this.socketIOQuestionService
      ),
      new AnswerSubmittedEventHandler(
        socket,
        eventEmitter,
        this.socketIOQuestionService
      ),
      new AnswerResultEventHandler(
        socket,
        eventEmitter,
        this.socketIOQuestionService
      ),
      new SkipQuestionEventHandler(
        socket,
        eventEmitter,
        this.socketIOQuestionService
      ),
    ];
  }

  /**
   * Create all available handlers
   */
  public createAllHandlers(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter
  ): BaseSocketEventHandler[] {
    return [
      ...this.createGameHandlers(socket, eventEmitter),
      ...this.createSystemHandlers(socket, eventEmitter),
      ...this.createQuestionHandlers(socket, eventEmitter),
    ];
  }
}

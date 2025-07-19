import { Socket } from "socket.io";

import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { UserNotificationRoomService } from "application/services/socket/UserNotificationRoomService";
import { BaseSocketEventHandler } from "domain/handlers/socket/BaseSocketEventHandler";
import { FinalAnswerReviewEventHandler } from "domain/handlers/socket/finalround/FinalAnswerReviewEventHandler";
import { FinalAnswerSubmitEventHandler } from "domain/handlers/socket/finalround/FinalAnswerSubmitEventHandler";
import { FinalBidSubmitEventHandler } from "domain/handlers/socket/finalround/FinalBidSubmitEventHandler";
import { ThemeEliminateEventHandler } from "domain/handlers/socket/finalround/ThemeEliminateEventHandler";
import { JoinGameEventHandler } from "domain/handlers/socket/game/JoinGameEventHandler";
import { LeaveGameEventHandler } from "domain/handlers/socket/game/LeaveGameEventHandler";
import { NextRoundEventHandler } from "domain/handlers/socket/game/NextRoundEventHandler";
import { PauseGameEventHandler } from "domain/handlers/socket/game/PauseGameEventHandler";
import { PlayerKickEventHandler } from "domain/handlers/socket/game/PlayerKickEventHandler";
import { PlayerReadyEventHandler } from "domain/handlers/socket/game/PlayerReadyEventHandler";
import { PlayerRestrictionEventHandler } from "domain/handlers/socket/game/PlayerRestrictionEventHandler";
import { PlayerRoleChangeEventHandler } from "domain/handlers/socket/game/PlayerRoleChangeEventHandler";
import { PlayerScoreChangeEventHandler } from "domain/handlers/socket/game/PlayerScoreChangeEventHandler";
import { PlayerSlotChangeEventHandler } from "domain/handlers/socket/game/PlayerSlotChangeEventHandler";
import { PlayerUnreadyEventHandler } from "domain/handlers/socket/game/PlayerUnreadyEventHandler";
import { StartGameEventHandler } from "domain/handlers/socket/game/StartGameEventHandler";
import { TurnPlayerChangeEventHandler } from "domain/handlers/socket/game/TurnPlayerChangeEventHandler";
import { UnpauseGameEventHandler } from "domain/handlers/socket/game/UnpauseGameEventHandler";
import { AnswerResultEventHandler } from "domain/handlers/socket/question/AnswerResultEventHandler";
import { AnswerSubmittedEventHandler } from "domain/handlers/socket/question/AnswerSubmittedEventHandler";
import { QuestionAnswerEventHandler } from "domain/handlers/socket/question/QuestionAnswerEventHandler";
import { QuestionPickEventHandler } from "domain/handlers/socket/question/QuestionPickEventHandler";
import { QuestionSkipEventHandler } from "domain/handlers/socket/question/QuestionSkipEventHandler";
import { QuestionUnskipEventHandler } from "domain/handlers/socket/question/QuestionUnskipEventHandler";
import { SkipQuestionEventHandler } from "domain/handlers/socket/question/SkipQuestionEventHandler";
import { ChatMessageEventHandler } from "domain/handlers/socket/system/ChatMessageEventHandler";
import { DisconnectEventHandler } from "domain/handlers/socket/system/DisconnectEventHandler";
import { ILogger } from "infrastructure/logger/ILogger";
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
    private readonly finalRoundService: FinalRoundService,
    private readonly userNotificationRoomService: UserNotificationRoomService,
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly logger: ILogger
  ) {
    //
  }

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
        this.logger,
        this.socketIOGameService,
        this.socketIOChatService,
        this.socketUserDataService,
        this.userNotificationRoomService
      ),
      new LeaveGameEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOGameService,
        this.userNotificationRoomService
      ),
      new StartGameEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOGameService
      ),
      new NextRoundEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOGameService
      ),
      new PauseGameEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOGameService
      ),
      new UnpauseGameEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOGameService
      ),
      new PlayerReadyEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOGameService
      ),
      new PlayerUnreadyEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOGameService
      ),
      new PlayerKickEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOGameService
      ),
      new PlayerRestrictionEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOGameService
      ),
      new PlayerRoleChangeEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOGameService
      ),
      new PlayerScoreChangeEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOGameService
      ),
      new TurnPlayerChangeEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOGameService
      ),
      new PlayerSlotChangeEventHandler(
        socket,
        eventEmitter,
        this.logger,
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
        this.logger,
        this.socketIOGameService
      ),
      new ChatMessageEventHandler(
        socket,
        eventEmitter,
        this.logger,
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
        this.logger,
        this.socketIOQuestionService
      ),
      new QuestionAnswerEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOQuestionService
      ),
      new AnswerSubmittedEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOQuestionService
      ),
      new AnswerResultEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOQuestionService
      ),
      new SkipQuestionEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOQuestionService
      ),
      new QuestionSkipEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOQuestionService
      ),
      new QuestionUnskipEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.socketIOQuestionService
      ),
    ];
  }

  /**
   * Create final round event handlers
   */
  public createFinalRoundHandlers(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter
  ): BaseSocketEventHandler[] {
    return [
      new ThemeEliminateEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.finalRoundService
      ),
      new FinalBidSubmitEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.finalRoundService
      ),
      new FinalAnswerSubmitEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.finalRoundService
      ),
      new FinalAnswerReviewEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.finalRoundService
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
      ...this.createFinalRoundHandlers(socket, eventEmitter),
    ];
  }
}

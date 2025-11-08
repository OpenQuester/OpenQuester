import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { UserNotificationRoomService } from "application/services/socket/UserNotificationRoomService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { UserService } from "application/services/user/UserService";
import { BaseSocketEventHandler } from "domain/handlers/socket/BaseSocketEventHandler";
import { FinalAnswerReviewEventHandler } from "domain/handlers/socket/finalround/FinalAnswerReviewEventHandler";
import { FinalAnswerSubmitEventHandler } from "domain/handlers/socket/finalround/FinalAnswerSubmitEventHandler";
import { FinalBidSubmitEventHandler } from "domain/handlers/socket/finalround/FinalBidSubmitEventHandler";
import { ThemeEliminateEventHandler } from "domain/handlers/socket/finalround/ThemeEliminateEventHandler";
import { JoinGameEventHandler } from "domain/handlers/socket/game/JoinGameEventHandler";
import { LeaveGameEventHandler } from "domain/handlers/socket/game/LeaveGameEventHandler";
import { MediaDownloadedEventHandler } from "domain/handlers/socket/game/MediaDownloadedEventHandler";
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
import { SecretQuestionTransferEventHandler } from "domain/handlers/socket/question/SecretQuestionTransferEventHandler";
import { SkipQuestionEventHandler } from "domain/handlers/socket/question/SkipQuestionEventHandler";
import { StakeBidSubmitEventHandler } from "domain/handlers/socket/question/StakeBidSubmitEventHandler";
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
    private readonly gameStatisticsCollectorService: GameStatisticsCollectorService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly userService: UserService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator,
    private readonly gameActionExecutor: GameActionExecutor,
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
        this.gameActionExecutor,
        this.socketIOGameService,
        this.socketIOChatService,
        this.socketUserDataService,
        this.userNotificationRoomService,
        this.userService,
        this.socketGameContextService
      ),
      new LeaveGameEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOGameService,
        this.userNotificationRoomService,
        this.socketGameContextService
      ),
      new StartGameEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOGameService,
        this.socketGameContextService
      ),
      new NextRoundEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOGameService,
        this.gameProgressionCoordinator,
        this.socketGameContextService
      ),
      new PauseGameEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOGameService,
        this.socketGameContextService
      ),
      new UnpauseGameEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOGameService,
        this.socketGameContextService
      ),
      new PlayerReadyEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOGameService,
        this.socketGameContextService
      ),
      new PlayerUnreadyEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOGameService,
        this.socketGameContextService
      ),
      new MediaDownloadedEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOQuestionService,
        this.socketGameContextService
      ),
      new PlayerKickEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOGameService,
        this.socketGameContextService
      ),
      new PlayerRestrictionEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOGameService,
        this.socketGameContextService
      ),
      new PlayerRoleChangeEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOGameService,
        this.socketGameContextService
      ),
      new PlayerScoreChangeEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOGameService,
        this.socketGameContextService
      ),
      new TurnPlayerChangeEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOGameService,
        this.socketGameContextService
      ),
      new PlayerSlotChangeEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOGameService,
        this.socketGameContextService
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
        this.gameActionExecutor,
        this.socketIOGameService,
        this.socketUserDataService
      ),
      new ChatMessageEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
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
        this.gameActionExecutor,
        this.socketIOQuestionService,
        this.socketGameContextService
      ),
      new QuestionAnswerEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOQuestionService,
        this.socketGameContextService
      ),
      new AnswerSubmittedEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOQuestionService,
        this.socketGameContextService
      ),
      new AnswerResultEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOQuestionService,
        this.gameProgressionCoordinator,
        this.socketGameContextService
      ),
      new SkipQuestionEventHandler(
        this.socketIOQuestionService,
        this.gameProgressionCoordinator,
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketGameContextService
      ),
      new QuestionSkipEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOQuestionService,
        this.gameProgressionCoordinator,
        this.socketGameContextService
      ),
      new QuestionUnskipEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOQuestionService,
        this.socketGameContextService
      ),
      new SecretQuestionTransferEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOQuestionService,
        this.socketGameContextService
      ),
      new StakeBidSubmitEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.socketIOQuestionService,
        this.socketGameContextService
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
        this.gameActionExecutor,
        this.finalRoundService,
        this.socketGameContextService
      ),
      new FinalBidSubmitEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.finalRoundService,
        this.socketGameContextService
      ),
      new FinalAnswerSubmitEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.finalRoundService,
        this.socketGameContextService
      ),
      new FinalAnswerReviewEventHandler(
        socket,
        eventEmitter,
        this.logger,
        this.gameActionExecutor,
        this.finalRoundService,
        this.gameStatisticsCollectorService,
        this.socketGameContextService
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

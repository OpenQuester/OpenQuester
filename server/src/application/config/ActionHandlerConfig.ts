import { GameActionHandlerRegistry } from "application/registries/GameActionHandlerRegistry";
import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { GameService } from "application/services/game/GameService";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { TimerExpirationService } from "application/services/timer/TimerExpirationService";
import { UserService } from "application/services/user/UserService";
import { GameActionType } from "domain/enums/GameActionType";
import {
  FinalAnswerReviewActionHandler,
  FinalAnswerSubmitActionHandler,
  FinalBidSubmitActionHandler,
  ThemeEliminateActionHandler,
} from "domain/handlers/action/finalround";
import {
  JoinGameActionHandler,
  LeaveGameActionHandler,
  MediaDownloadedActionHandler,
  NextRoundActionHandler,
  PauseGameActionHandler,
  PlayerKickActionHandler,
  PlayerReadyActionHandler,
  PlayerRestrictionActionHandler,
  PlayerRoleChangeActionHandler,
  PlayerScoreChangeActionHandler,
  PlayerSlotChangeActionHandler,
  PlayerUnreadyActionHandler,
  StartGameActionHandler,
  TurnPlayerChangeActionHandler,
  UnpauseGameActionHandler,
} from "domain/handlers/action/game";
import {
  AnswerResultActionHandler,
  AnswerSubmittedActionHandler,
  QuestionAnswerActionHandler,
  QuestionPickActionHandler,
  QuestionSkipActionHandler,
  QuestionUnskipActionHandler,
  SecretQuestionTransferActionHandler,
  SkipQuestionForceActionHandler,
  StakeBidSubmitActionHandler,
} from "domain/handlers/action/question";
import { DisconnectActionHandler } from "domain/handlers/action/system";
import { TimerExpirationActionHandler } from "domain/handlers/action/timer";
import { ILogger } from "infrastructure/logger/ILogger";

/**
 * Dependencies required for configuring action handlers.
 */
export interface ActionHandlerConfigDeps {
  registry: GameActionHandlerRegistry;
  finalRoundService: FinalRoundService;
  socketIOGameService: SocketIOGameService;
  socketIOChatService: SocketIOChatService;
  socketIOQuestionService: SocketIOQuestionService;
  socketGameContextService: SocketGameContextService;
  userService: UserService;
  gameProgressionCoordinator: GameProgressionCoordinator;
  gameStatisticsCollectorService: GameStatisticsCollectorService;
  gameService: GameService;
  timerExpirationService: TimerExpirationService;
  logger: ILogger;
}

/**
 * Configures and registers all game action handlers.
 *
 * Action handlers are stateless and can be executed by any server instance.
 * They are registered by action type in the GameActionHandlerRegistry.
 */
export function configureActionHandlers(deps: ActionHandlerConfigDeps): void {
  const {
    registry,
    finalRoundService,
    socketIOGameService,
    socketIOChatService,
    socketIOQuestionService,
    socketGameContextService,
    userService,
    gameProgressionCoordinator,
    gameStatisticsCollectorService,
    gameService,
    timerExpirationService,
    logger,
  } = deps;

  // =====================================
  // Game Lifecycle Handlers
  // =====================================
  registry.register(
    GameActionType.JOIN,
    new JoinGameActionHandler(
      socketIOGameService,
      socketIOChatService,
      userService,
      socketGameContextService
    )
  );

  registry.register(
    GameActionType.LEAVE,
    new LeaveGameActionHandler(socketIOGameService)
  );

  registry.register(
    GameActionType.START,
    new StartGameActionHandler(socketIOGameService)
  );

  registry.register(
    GameActionType.PAUSE,
    new PauseGameActionHandler(socketIOGameService)
  );

  registry.register(
    GameActionType.UNPAUSE,
    new UnpauseGameActionHandler(socketIOGameService)
  );

  registry.register(
    GameActionType.NEXT_ROUND,
    new NextRoundActionHandler(socketIOGameService, gameProgressionCoordinator)
  );

  // =====================================
  // Player Management Handlers
  // =====================================
  registry.register(
    GameActionType.PLAYER_READY,
    new PlayerReadyActionHandler(socketIOGameService)
  );

  registry.register(
    GameActionType.PLAYER_UNREADY,
    new PlayerUnreadyActionHandler(socketIOGameService)
  );

  registry.register(
    GameActionType.PLAYER_KICK,
    new PlayerKickActionHandler(socketIOGameService)
  );

  registry.register(
    GameActionType.PLAYER_RESTRICTION,
    new PlayerRestrictionActionHandler(socketIOGameService)
  );

  registry.register(
    GameActionType.PLAYER_ROLE_CHANGE,
    new PlayerRoleChangeActionHandler(socketIOGameService)
  );

  registry.register(
    GameActionType.PLAYER_SCORE_CHANGE,
    new PlayerScoreChangeActionHandler(socketIOGameService)
  );

  registry.register(
    GameActionType.PLAYER_SLOT_CHANGE,
    new PlayerSlotChangeActionHandler(socketIOGameService)
  );

  registry.register(
    GameActionType.TURN_PLAYER_CHANGE,
    new TurnPlayerChangeActionHandler(socketIOGameService)
  );

  // =====================================
  // Question Handlers
  // =====================================
  registry.register(
    GameActionType.QUESTION_PICK,
    new QuestionPickActionHandler(socketIOQuestionService)
  );

  registry.register(
    GameActionType.QUESTION_ANSWER,
    new QuestionAnswerActionHandler(socketIOQuestionService)
  );

  registry.register(
    GameActionType.ANSWER_SUBMITTED,
    new AnswerSubmittedActionHandler(socketIOQuestionService)
  );

  registry.register(
    GameActionType.ANSWER_RESULT,
    new AnswerResultActionHandler(
      socketIOQuestionService,
      gameProgressionCoordinator
    )
  );

  registry.register(
    GameActionType.QUESTION_SKIP,
    new QuestionSkipActionHandler(
      socketIOQuestionService,
      gameProgressionCoordinator
    )
  );

  registry.register(
    GameActionType.QUESTION_UNSKIP,
    new QuestionUnskipActionHandler(socketIOQuestionService)
  );

  registry.register(
    GameActionType.SKIP_QUESTION_FORCE,
    new SkipQuestionForceActionHandler(
      socketIOQuestionService,
      gameProgressionCoordinator
    )
  );

  registry.register(
    GameActionType.SECRET_QUESTION_TRANSFER,
    new SecretQuestionTransferActionHandler(socketIOQuestionService)
  );

  registry.register(
    GameActionType.STAKE_BID_SUBMIT,
    new StakeBidSubmitActionHandler(socketIOQuestionService)
  );

  // =====================================
  // Final Round Handlers
  // =====================================
  registry.register(
    GameActionType.FINAL_BID_SUBMIT,
    new FinalBidSubmitActionHandler(finalRoundService)
  );

  registry.register(
    GameActionType.THEME_ELIMINATE,
    new ThemeEliminateActionHandler(finalRoundService)
  );

  registry.register(
    GameActionType.FINAL_ANSWER_SUBMIT,
    new FinalAnswerSubmitActionHandler(finalRoundService)
  );

  registry.register(
    GameActionType.FINAL_ANSWER_REVIEW,
    new FinalAnswerReviewActionHandler(
      finalRoundService,
      gameStatisticsCollectorService,
      logger
    )
  );

  // =====================================
  // System Handlers
  // =====================================
  registry.register(
    GameActionType.DISCONNECT,
    new DisconnectActionHandler(socketIOGameService)
  );

  registry.register(
    GameActionType.MEDIA_DOWNLOADED,
    new MediaDownloadedActionHandler(socketIOQuestionService)
  );

  // Note: CHAT_MESSAGE does not need action queue per user request
  // Chat messages are processed directly by socket handler without locking

  // =====================================
  // Timer Handlers - single handler for all timer types
  // =====================================
  const timerHandler = new TimerExpirationActionHandler(
    gameService,
    timerExpirationService,
    logger
  );

  registry.register(GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED, timerHandler);
  registry.register(
    GameActionType.TIMER_QUESTION_SHOWING_EXPIRED,
    timerHandler
  );
  registry.register(
    GameActionType.TIMER_QUESTION_ANSWERING_EXPIRED,
    timerHandler
  );
  registry.register(
    GameActionType.TIMER_THEME_ELIMINATION_EXPIRED,
    timerHandler
  );
  registry.register(GameActionType.TIMER_BIDDING_EXPIRED, timerHandler);
  registry.register(GameActionType.TIMER_FINAL_ANSWERING_EXPIRED, timerHandler);

  logger.info(`Registered ${registry.getStats().total} action handlers`, {
    prefix: "[ACTION_CONFIG]: ",
  });
}

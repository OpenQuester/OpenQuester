import { GameActionHandlerRegistry } from "application/registries/GameActionHandlerRegistry";
import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { GameService } from "application/services/game/GameService";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOAnswerResult } from "application/services/socket/SocketIOAnswerResult";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { TimerExpirationService } from "application/services/timer/TimerExpirationService";
import { UserService } from "application/services/user/UserService";
import { GameActionType } from "domain/enums/GameActionType";
import { FinalAnswerReviewActionHandler } from "domain/handlers/action/finalround/FinalAnswerReviewActionHandler";
import { FinalAnswerSubmitActionHandler } from "domain/handlers/action/finalround/FinalAnswerSubmitActionHandler";
import { FinalBidSubmitActionHandler } from "domain/handlers/action/finalround/FinalBidSubmitActionHandler";
import { ThemeEliminateActionHandler } from "domain/handlers/action/finalround/ThemeEliminateActionHandler";
import { JoinGameActionHandler } from "domain/handlers/action/game/JoinGameActionHandler";
import { LeaveGameActionHandler } from "domain/handlers/action/game/LeaveGameActionHandler";
import { MediaDownloadedActionHandler } from "domain/handlers/action/game/MediaDownloadedActionHandler";
import { NextRoundActionHandler } from "domain/handlers/action/game/NextRoundActionHandler";
import { PauseGameActionHandler } from "domain/handlers/action/game/PauseGameActionHandler";
import { PlayerKickActionHandler } from "domain/handlers/action/game/PlayerKickActionHandler";
import { PlayerReadyActionHandler } from "domain/handlers/action/game/PlayerReadyActionHandler";
import { PlayerRestrictionActionHandler } from "domain/handlers/action/game/PlayerRestrictionActionHandler";
import { PlayerRoleChangeActionHandler } from "domain/handlers/action/game/PlayerRoleChangeActionHandler";
import { PlayerScoreChangeActionHandler } from "domain/handlers/action/game/PlayerScoreChangeActionHandler";
import { PlayerSlotChangeActionHandler } from "domain/handlers/action/game/PlayerSlotChangeActionHandler";
import { PlayerUnreadyActionHandler } from "domain/handlers/action/game/PlayerUnreadyActionHandler";
import { StartGameActionHandler } from "domain/handlers/action/game/StartGameActionHandler";
import { TurnPlayerChangeActionHandler } from "domain/handlers/action/game/TurnPlayerChangeActionHandler";
import { UnpauseGameActionHandler } from "domain/handlers/action/game/UnpauseGameActionHandler";
import { AnswerResultActionHandler } from "domain/handlers/action/question/AnswerResultActionHandler";
import { AnswerSubmittedActionHandler } from "domain/handlers/action/question/AnswerSubmittedActionHandler";
import { QuestionAnswerActionHandler } from "domain/handlers/action/question/QuestionAnswerActionHandler";
import { QuestionPickActionHandler } from "domain/handlers/action/question/QuestionPickActionHandler";
import { QuestionSkipActionHandler } from "domain/handlers/action/question/QuestionSkipActionHandler";
import { QuestionUnskipActionHandler } from "domain/handlers/action/question/QuestionUnskipActionHandler";
import { SecretQuestionTransferActionHandler } from "domain/handlers/action/question/SecretQuestionTransferActionHandler";
import { SkipQuestionForceActionHandler } from "domain/handlers/action/question/SkipQuestionForceActionHandler";
import { SkipShowAnswerActionHandler } from "domain/handlers/action/question/SkipShowAnswerActionHandler";
import { StakeBidSubmitActionHandler } from "domain/handlers/action/question/StakeBidSubmitActionHandler";
import { DisconnectActionHandler } from "domain/handlers/action/system/DisconnectActionHandler";
import { TimerExpirationActionHandler } from "domain/handlers/action/timer/TimerExpirationActionHandler";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

/**
 * Dependencies required for configuring action handlers.
 */
export interface ActionHandlerConfigDeps {
  registry: GameActionHandlerRegistry;
  finalRoundService: FinalRoundService;
  socketIOGameService: SocketIOGameService;
  socketIOChatService: SocketIOChatService;
  socketIOQuestionService: SocketIOQuestionService;
  socketIOAnswerResult: SocketIOAnswerResult;
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
    socketIOAnswerResult,
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
    new AnswerResultActionHandler(socketIOAnswerResult)
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
    GameActionType.SKIP_SHOW_ANSWER,
    new SkipShowAnswerActionHandler(socketIOQuestionService)
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
    prefix: LogPrefix.ACTION_CONFIG,
  });
}

import { GameActionHandlerRegistry } from "application/registries/GameActionHandlerRegistry";
import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { GameService } from "application/services/game/GameService";
import { SecretQuestionService } from "application/services/question/SecretQuestionService";
import { StakeQuestionService } from "application/services/question/StakeQuestionService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { TimerExpirationService } from "application/services/timer/TimerExpirationService";
import { UserService } from "application/services/user/UserService";
import { JoinGameUseCase } from "application/usecases/game/JoinGameUseCase";
import { GameActionType } from "domain/enums/GameActionType";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalAnswerReviewActionHandler } from "domain/handlers/action/finalround/FinalAnswerReviewActionHandler";
import { FinalAnswerSubmitActionHandler } from "domain/handlers/action/finalround/FinalAnswerSubmitActionHandler";
import { FinalBidSubmitActionHandler } from "domain/handlers/action/finalround/FinalBidSubmitActionHandler";
import { ThemeEliminateActionHandler } from "domain/handlers/action/finalround/ThemeEliminateActionHandler";
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
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

/**
 * Dependencies required for configuring action handlers.
 */
export interface ActionHandlerConfigDeps {
  registry: GameActionHandlerRegistry;
  socketIOGameService: SocketIOGameService;
  socketGameValidationService: SocketGameValidationService;
  socketIOChatService: SocketIOChatService;
  socketIOQuestionService: SocketIOQuestionService;
  socketGameTimerService: SocketGameTimerService;
  secretQuestionService: SecretQuestionService;
  stakeQuestionService: StakeQuestionService;
  playerGameStatsService: PlayerGameStatsService;
  gameStatisticsCollectorService: GameStatisticsCollectorService;
  userService: UserService;
  gameProgressionCoordinator: GameProgressionCoordinator;
  gameService: GameService;
  timerExpirationService: TimerExpirationService;
  phaseTransitionRouter: PhaseTransitionRouter;
  roundHandlerFactory: RoundHandlerFactory;
  packageStore: PackageStore;
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
    socketIOGameService,
    socketIOChatService,
    socketIOQuestionService,
    socketGameTimerService,
    secretQuestionService,
    stakeQuestionService,
    playerGameStatsService,
    gameStatisticsCollectorService,
    userService,
    gameProgressionCoordinator,
    timerExpirationService,
    phaseTransitionRouter,
    roundHandlerFactory,
    packageStore,
    logger,
  } = deps;

  // =====================================
  // Game Lifecycle Handlers
  // =====================================
  registry.register(
    GameActionType.JOIN,
    new JoinGameUseCase(userService, socketIOChatService)
  );

  registry.register(
    GameActionType.LEAVE,
    new LeaveGameActionHandler(socketIOGameService)
  );

  registry.register(
    GameActionType.START,
    new StartGameActionHandler(
      deps.socketGameValidationService,
      packageStore,
      gameStatisticsCollectorService,
      logger
    )
  );

  registry.register(
    GameActionType.PAUSE,
    new PauseGameActionHandler(
      deps.socketGameValidationService,
      socketGameTimerService
    )
  );

  registry.register(
    GameActionType.UNPAUSE,
    new UnpauseGameActionHandler(
      deps.socketGameValidationService,
      socketGameTimerService,
      deps.gameService
    )
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
    new PlayerReadyActionHandler(socketIOGameService, packageStore)
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
    new PlayerRoleChangeActionHandler(
      deps.socketGameValidationService,
      playerGameStatsService
    )
  );

  registry.register(
    GameActionType.PLAYER_SCORE_CHANGE,
    new PlayerScoreChangeActionHandler(deps.socketGameValidationService)
  );

  registry.register(
    GameActionType.PLAYER_SLOT_CHANGE,
    new PlayerSlotChangeActionHandler(deps.socketGameValidationService)
  );

  registry.register(
    GameActionType.TURN_PLAYER_CHANGE,
    new TurnPlayerChangeActionHandler(deps.socketGameValidationService)
  );

  // =====================================
  // Question Handlers
  // =====================================
  registry.register(
    GameActionType.QUESTION_PICK,
    new QuestionPickActionHandler(packageStore, phaseTransitionRouter)
  );

  registry.register(
    GameActionType.QUESTION_ANSWER,
    new QuestionAnswerActionHandler(
      socketIOQuestionService,
      phaseTransitionRouter,
      socketGameTimerService
    )
  );

  registry.register(
    GameActionType.ANSWER_SUBMITTED,
    new AnswerSubmittedActionHandler(socketIOQuestionService)
  );

  registry.register(
    GameActionType.ANSWER_RESULT,
    new AnswerResultActionHandler(
      phaseTransitionRouter,
      playerGameStatsService,
      logger
    )
  );

  registry.register(
    GameActionType.QUESTION_SKIP,
    new QuestionSkipActionHandler(
      phaseTransitionRouter,
      socketGameTimerService,
      playerGameStatsService,
      logger
    )
  );

  registry.register(
    GameActionType.QUESTION_UNSKIP,
    new QuestionUnskipActionHandler()
  );

  registry.register(
    GameActionType.SKIP_QUESTION_FORCE,
    new SkipQuestionForceActionHandler(packageStore)
  );

  registry.register(
    GameActionType.SKIP_SHOW_ANSWER,
    new SkipShowAnswerActionHandler(phaseTransitionRouter)
  );

  registry.register(
    GameActionType.SECRET_QUESTION_TRANSFER,
    new SecretQuestionTransferActionHandler(secretQuestionService)
  );

  registry.register(
    GameActionType.STAKE_BID_SUBMIT,
    new StakeBidSubmitActionHandler(stakeQuestionService)
  );

  // =====================================
  // Final Round Handlers
  // =====================================
  registry.register(
    GameActionType.FINAL_BID_SUBMIT,
    new FinalBidSubmitActionHandler(phaseTransitionRouter)
  );

  registry.register(
    GameActionType.THEME_ELIMINATE,
    new ThemeEliminateActionHandler(phaseTransitionRouter, roundHandlerFactory)
  );

  registry.register(
    GameActionType.FINAL_ANSWER_SUBMIT,
    new FinalAnswerSubmitActionHandler(
      deps.socketGameValidationService,
      phaseTransitionRouter
    )
  );

  registry.register(
    GameActionType.FINAL_ANSWER_REVIEW,
    new FinalAnswerReviewActionHandler(
      deps.socketGameValidationService,
      phaseTransitionRouter
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
    new MediaDownloadedActionHandler(phaseTransitionRouter)
  );

  // Note: CHAT_MESSAGE does not need action queue per user request
  // Chat messages are processed directly by socket handler without locking

  // =====================================
  // Timer Handlers - single handler for all timer types
  // =====================================
  const timerHandler = new TimerExpirationActionHandler(
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

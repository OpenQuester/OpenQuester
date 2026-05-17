import { GameActionHandlerRegistry } from "application/registries/GameActionHandlerRegistry";
import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { GameService } from "application/services/game/GameService";
import { PlayerLeaveService } from "application/services/game/PlayerLeaveService";
import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { SecretQuestionService } from "application/services/question/SecretQuestionService";
import { StakeQuestionService } from "application/services/question/StakeQuestionService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { TimerExpirationService } from "application/services/timer/TimerExpirationService";
import { UserService } from "application/services/user/UserService";
import { FinalAnswerReviewUseCase } from "application/usecases/finalround/FinalAnswerReviewUseCase";
import { FinalAnswerSubmitUseCase } from "application/usecases/finalround/FinalAnswerSubmitUseCase";
import { FinalBidSubmitUseCase } from "application/usecases/finalround/FinalBidSubmitUseCase";
import { ThemeEliminateUseCase } from "application/usecases/finalround/ThemeEliminateUseCase";
import { JoinGameUseCase } from "application/usecases/game/JoinGameUseCase";
import { LeaveGameUseCase } from "application/usecases/game/LeaveGameUseCase";
import { MediaDownloadedUseCase } from "application/usecases/game/MediaDownloadedUseCase";
import { NextRoundUseCase } from "application/usecases/game/NextRoundUseCase";
import { PauseGameUseCase } from "application/usecases/game/PauseGameUseCase";
import { PlayerKickUseCase } from "application/usecases/game/PlayerKickUseCase";
import { PlayerReadyUseCase } from "application/usecases/game/PlayerReadyUseCase";
import { PlayerRestrictionUseCase } from "application/usecases/game/PlayerRestrictionUseCase";
import { PlayerRoleChangeUseCase } from "application/usecases/game/PlayerRoleChangeUseCase";
import { PlayerScoreChangeUseCase } from "application/usecases/game/PlayerScoreChangeUseCase";
import { PlayerSlotChangeUseCase } from "application/usecases/game/PlayerSlotChangeUseCase";
import { PlayerUnreadyUseCase } from "application/usecases/game/PlayerUnreadyUseCase";
import { StartGameUseCase } from "application/usecases/game/StartGameUseCase";
import { TurnPlayerChangeUseCase } from "application/usecases/game/TurnPlayerChangeUseCase";
import { UnpauseGameUseCase } from "application/usecases/game/UnpauseGameUseCase";
import { AnswerResultUseCase } from "application/usecases/question/AnswerResultUseCase";
import { AnswerSubmittedUseCase } from "application/usecases/question/AnswerSubmittedUseCase";
import { QuestionAnswerUseCase } from "application/usecases/question/QuestionAnswerUseCase";
import { QuestionPickUseCase } from "application/usecases/question/QuestionPickUseCase";
import { QuestionSkipUseCase } from "application/usecases/question/QuestionSkipUseCase";
import { QuestionUnskipUseCase } from "application/usecases/question/QuestionUnskipUseCase";
import { SecretQuestionTransferUseCase } from "application/usecases/question/SecretQuestionTransferUseCase";
import { SkipQuestionForceUseCase } from "application/usecases/question/SkipQuestionForceUseCase";
import { SkipShowAnswerUseCase } from "application/usecases/question/SkipShowAnswerUseCase";
import { StakeBidSubmitUseCase } from "application/usecases/question/StakeBidSubmitUseCase";
import { ChatMessageUseCase } from "application/usecases/direct/ChatMessageUseCase";
import { DisconnectUseCase } from "application/usecases/system/DisconnectUseCase";
import { TimerExpirationUseCase } from "application/usecases/timer/TimerExpirationUseCase";
import { GameActionType } from "domain/enums/GameActionType";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { SocketChatRepository } from "infrastructure/database/repositories/socket/SocketChatRepository";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

/**
 * Dependencies required for configuring action handlers.
 */
export interface ActionHandlerConfigDeps {
  registry: GameActionHandlerRegistry;
  socketGameValidationService: SocketGameValidationService;
  socketIOChatService: SocketIOChatService;
  socketGameTimerService: SocketGameTimerService;
  secretQuestionService: SecretQuestionService;
  stakeQuestionService: StakeQuestionService;
  playerGameStatsService: PlayerGameStatsService;
  gameStatisticsCollectorService: GameStatisticsCollectorService;
  userService: UserService;
  socketChatRepository: SocketChatRepository;
  gameProgressionCoordinator: GameProgressionCoordinator;
  gameService: GameService;
  timerExpirationService: TimerExpirationService;
  phaseTransitionRouter: PhaseTransitionRouter;
  playerLeaveService: PlayerLeaveService;
  transitionResourceService: TransitionResourceService;
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
    socketIOChatService,
    socketGameTimerService,
    secretQuestionService,
    stakeQuestionService,
    playerGameStatsService,
    gameStatisticsCollectorService,
    userService,
    socketChatRepository,
    gameProgressionCoordinator,
    gameService,
    timerExpirationService,
    phaseTransitionRouter,
    playerLeaveService,
    transitionResourceService,
    socketGameValidationService,
    packageStore,
    logger
  } = deps;

  // =====================================
  // Game Lifecycle Handlers
  // =====================================
  registry.register(GameActionType.JOIN, new JoinGameUseCase(userService, socketIOChatService));

  registry.register(GameActionType.LEAVE, new LeaveGameUseCase(playerLeaveService));

  registry.register(
    GameActionType.START,
    new StartGameUseCase(packageStore, gameStatisticsCollectorService, logger)
  );

  registry.register(GameActionType.PAUSE, new PauseGameUseCase(socketGameTimerService));

  registry.register(
    GameActionType.UNPAUSE,
    new UnpauseGameUseCase(socketGameTimerService, gameService)
  );

  registry.register(
    GameActionType.NEXT_ROUND,
    new NextRoundUseCase(packageStore, socketGameTimerService, gameProgressionCoordinator)
  );

  // =====================================
  // Player Management Handlers
  // =====================================
  registry.register(GameActionType.PLAYER_READY, new PlayerReadyUseCase(packageStore));

  registry.register(GameActionType.PLAYER_UNREADY, new PlayerUnreadyUseCase());

  registry.register(GameActionType.PLAYER_KICK, new PlayerKickUseCase(playerLeaveService));

  registry.register(
    GameActionType.PLAYER_RESTRICTION,
    new PlayerRestrictionUseCase(playerLeaveService)
  );

  registry.register(
    GameActionType.PLAYER_ROLE_CHANGE,
    new PlayerRoleChangeUseCase(socketGameValidationService, playerGameStatsService)
  );

  registry.register(GameActionType.PLAYER_SCORE_CHANGE, new PlayerScoreChangeUseCase());

  registry.register(
    GameActionType.PLAYER_SLOT_CHANGE,
    new PlayerSlotChangeUseCase(socketGameValidationService)
  );

  registry.register(GameActionType.TURN_PLAYER_CHANGE, new TurnPlayerChangeUseCase());

  // =====================================
  // Question Handlers
  // =====================================
  registry.register(
    GameActionType.QUESTION_PICK,
    new QuestionPickUseCase(
      packageStore,
      phaseTransitionRouter,
      transitionResourceService
    )
  );

  registry.register(
    GameActionType.QUESTION_ANSWER,
    new QuestionAnswerUseCase(phaseTransitionRouter, socketGameTimerService)
  );

  registry.register(GameActionType.ANSWER_SUBMITTED, new AnswerSubmittedUseCase());

  registry.register(
    GameActionType.ANSWER_RESULT,
    new AnswerResultUseCase(
      phaseTransitionRouter,
      playerGameStatsService,
      transitionResourceService,
      logger
    )
  );

  registry.register(
    GameActionType.QUESTION_SKIP,
    new QuestionSkipUseCase(
      phaseTransitionRouter,
      socketGameTimerService,
      playerGameStatsService,
      transitionResourceService,
      logger
    )
  );

  registry.register(GameActionType.QUESTION_UNSKIP, new QuestionUnskipUseCase());

  registry.register(
    GameActionType.SKIP_QUESTION_FORCE,
    new SkipQuestionForceUseCase(
      packageStore,
      phaseTransitionRouter,
      transitionResourceService
    )
  );

  registry.register(
    GameActionType.SKIP_SHOW_ANSWER,
    new SkipShowAnswerUseCase(phaseTransitionRouter, transitionResourceService)
  );

  registry.register(
    GameActionType.SECRET_QUESTION_TRANSFER,
    new SecretQuestionTransferUseCase(secretQuestionService)
  );

  registry.register(
    GameActionType.STAKE_BID_SUBMIT,
    new StakeBidSubmitUseCase(stakeQuestionService)
  );

  // =====================================
  // Final Round Handlers
  // =====================================
  registry.register(
    GameActionType.FINAL_BID_SUBMIT,
    new FinalBidSubmitUseCase(phaseTransitionRouter, transitionResourceService)
  );

  registry.register(
    GameActionType.THEME_ELIMINATE,
    new ThemeEliminateUseCase(phaseTransitionRouter, transitionResourceService)
  );

  registry.register(
    GameActionType.FINAL_ANSWER_SUBMIT,
    new FinalAnswerSubmitUseCase(
      socketGameValidationService,
      phaseTransitionRouter,
      transitionResourceService
    )
  );

  registry.register(
    GameActionType.FINAL_ANSWER_REVIEW,
    new FinalAnswerReviewUseCase(
      socketGameValidationService,
      phaseTransitionRouter,
      transitionResourceService
    )
  );

  // =====================================
  // System Handlers
  // =====================================
  registry.register(GameActionType.DISCONNECT, new DisconnectUseCase(playerLeaveService));

  registry.register(
    GameActionType.MEDIA_DOWNLOADED,
    new MediaDownloadedUseCase(phaseTransitionRouter)
  );

  registry.register(
    GameActionType.CHAT_MESSAGE,
    new ChatMessageUseCase(userService, socketChatRepository)
  );

  // =====================================
  // Timer Handlers - single handler for all timer types
  // =====================================
  const timerHandler = new TimerExpirationUseCase(timerExpirationService, logger);

  registry.register(GameActionType.TIMER_MEDIA_DOWNLOAD_EXPIRED, timerHandler);
  registry.register(GameActionType.TIMER_QUESTION_SHOWING_EXPIRED, timerHandler);
  registry.register(GameActionType.TIMER_QUESTION_ANSWERING_EXPIRED, timerHandler);
  registry.register(GameActionType.TIMER_THEME_ELIMINATION_EXPIRED, timerHandler);
  registry.register(GameActionType.TIMER_BIDDING_EXPIRED, timerHandler);
  registry.register(GameActionType.TIMER_FINAL_ANSWERING_EXPIRED, timerHandler);

  logger.info(`Registered ${registry.getStats().total} action handlers`, {
    prefix: LogPrefix.ACTION_CONFIG
  });
}

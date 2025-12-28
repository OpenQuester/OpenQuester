import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalRoundHandler } from "domain/handlers/socket/round/FinalRoundHandler";
import { FinalAnswerSubmitLogic } from "domain/logic/final-round/FinalAnswerSubmitLogic";
import { FinalBidSubmitLogic } from "domain/logic/final-round/FinalBidSubmitLogic";
import { ThemeEliminateLogic } from "domain/logic/final-round/ThemeEliminateLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { AutoLossProcessLogic } from "domain/state-machine/logic/AutoLossProcessLogic";
import { BiddingInitializationLogic } from "domain/state-machine/logic/BiddingInitializationLogic";
import { BiddingTimeoutLogic } from "domain/state-machine/logic/BiddingTimeoutLogic";
import { FinalAnswerReviewLogic } from "domain/state-machine/logic/FinalAnswerReviewLogic";
import { TransitionTrigger } from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { FinalAnswerReviewInputData } from "domain/types/socket/events/FinalAnswerReviewData";
import { BiddingPhaseInitializationResult } from "domain/types/socket/events/FinalRoundEventData";
import {
  AutoLossProcessResult,
  BiddingTimeoutResult,
  FinalAnswerReviewResult,
  FinalAnswerSubmitResult,
  FinalBidSubmitResult,
  ThemeEliminateResult,
  ThemeEliminationTimeoutResult,
} from "domain/types/socket/finalround/FinalRoundResults";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Service for handling final round specific operations
 * Separate from general SocketIOGameService to handle different final round types
 */
export class FinalRoundService {
  constructor(
    private readonly gameService: GameService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly socketGameValidationService: SocketGameValidationService,
    private readonly roundHandlerFactory: RoundHandlerFactory,
    private readonly phaseTransitionRouter: PhaseTransitionRouter
  ) {
    //
  }

  /**
   * Handle theme elimination with automatic timer progression.
   *
   * Flow:
   * 1. Fetch context
   * 2. Validate preconditions (via Logic class)
   * 3. Eliminate theme (via Logic class)
   * 4. Try phase transition if elimination complete
   * 5. Persist and return result
   */
  public async handleThemeEliminate(
    socketId: string,
    themeId: number
  ): Promise<ThemeEliminateResult> {
    const { game, currentPlayer } =
      await this.socketGameContextService.fetchGameContext(socketId);

    const finalRoundHandler = this._getFinalRoundHandler(game);

    // Validate using Logic class
    ThemeEliminateLogic.validate({
      game,
      player: currentPlayer,
      themeId,
      finalRoundHandler,
    });

    // Eliminate theme using Logic class
    const mutationResult = ThemeEliminateLogic.eliminateTheme(
      game,
      themeId,
      finalRoundHandler
    );

    // Try phase transition
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { playerId: currentPlayer!.meta.id, isSystem: false },
    });

    await this.gameService.updateGame(game);

    return ThemeEliminateLogic.buildResult({
      game,
      eliminatedBy: currentPlayer!.meta.id,
      themeId,
      mutationResult,
      transitionResult,
    });
  }

  /**
   * Handle bidding submission with automatic timer progression.
   *
   * Flow:
   * 1. Fetch context (optimized single call)
   * 2. Validate preconditions
   * 3. Add bid to game state
   * 4. Try phase transition (handled by state machine)
   * 5. Persist and return result
   */
  public async handleFinalBidSubmit(
    socketId: string,
    bid: number
  ): Promise<FinalBidSubmitResult> {
    const { game, currentPlayer } =
      await this.socketGameContextService.fetchGameContext(socketId);

    FinalBidSubmitLogic.validate(game, currentPlayer);
    const normalizedBid = FinalBidSubmitLogic.addBid(
      game,
      currentPlayer.meta.id,
      bid
    );

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { playerId: currentPlayer.meta.id, isSystem: false },
    });

    await this.gameService.updateGame(game);

    return FinalBidSubmitLogic.buildResult({
      game,
      playerId: currentPlayer.meta.id,
      bidAmount: normalizedBid,
      transitionResult,
    });
  }

  /**
   * Handle answer submission with automatic phase progression.
   *
   * Flow:
   * 1. Fetch context
   * 2. Validate preconditions
   * 3. Add answer (via Logic class)
   * 4. Try phase transition if all answers submitted
   * 5. Persist and return result
   */
  public async handleFinalAnswerSubmit(
    socketId: string,
    answerText: string
  ): Promise<FinalAnswerSubmitResult> {
    const { game, currentPlayer } =
      await this.socketGameContextService.fetchGameContext(socketId);

    // Validation
    GameStateValidator.validateGameInProgress(game);
    this.socketGameValidationService.validateQuestionAction(
      currentPlayer,
      game,
      QuestionAction.SUBMIT_ANSWER
    );
    this.socketGameValidationService.validateFinalAnswerSubmission(
      game,
      currentPlayer
    );

    // At this point, currentPlayer is guaranteed to be non-null by validation
    const player = currentPlayer!;

    // Add answer using Logic class
    const mutationResult = FinalAnswerSubmitLogic.addAnswer(
      game,
      player.meta.id,
      answerText
    );

    // Check phase completion (needed for result even if transition handles phase change)
    const completionResult = FinalAnswerSubmitLogic.checkPhaseCompletion(game);

    // Try phase transition
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { playerId: player.meta.id, isSystem: false },
    });

    await this.gameService.updateGame(game);

    return FinalAnswerSubmitLogic.buildResult({
      game,
      player,
      mutationResult,
      completionResult,
      transitionResult,
    });
  }

  /**
   * Handle answer review with auto-loss processing.
   *
   * Uses FinalAnswerReviewLogic for validation and mutation,
   * then attempts phase transition via PhaseTransitionRouter.
   */
  public async handleFinalAnswerReview(
    socketId: string,
    answerData: FinalAnswerReviewInputData
  ): Promise<FinalAnswerReviewResult> {
    // Context & Validation
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    GameStateValidator.validateGameInProgress(game);
    this.socketGameValidationService.validateQuestionAction(
      currentPlayer,
      game,
      QuestionAction.RESULT
    );
    FinalAnswerReviewLogic.validate(game);

    // Execute review via Logic class
    const mutationResult = FinalAnswerReviewLogic.reviewAnswer(
      game,
      answerData
    );

    // Try phase transition if all answers reviewed
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: {
        playerId: currentPlayer?.meta.id,
        isSystem: false,
      },
    });

    // Persist game state
    await this.gameService.updateGame(game);

    return FinalAnswerReviewLogic.buildResult({
      game,
      mutationResult,
      transitionResult,
    });
  }

  /**
   * Handle theme elimination timeout - randomly eliminate a theme.
   *
   * Uses ThemeEliminateLogic for random selection and elimination,
   * then attempts phase transition via PhaseTransitionRouter.
   */
  public async handleThemeEliminationTimeout(
    gameId: string
  ): Promise<ThemeEliminationTimeoutResult> {
    const game = await this.gameService.getGameEntity(gameId);
    if (
      !game ||
      game.gameState.questionState !== QuestionState.THEME_ELIMINATION
    ) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    const finalRoundHandler = this._getFinalRoundHandler(game);

    // Select random theme via Logic class
    const themeId = ThemeEliminateLogic.selectRandomTheme(
      game,
      finalRoundHandler
    );

    // Eliminate theme via Logic class
    const mutationResult = ThemeEliminateLogic.eliminateTheme(
      game,
      themeId,
      finalRoundHandler
    );

    // Try phase transition (THEME_ELIMINATION → BIDDING)
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.TIMER_EXPIRED,
      triggeredBy: { isSystem: true },
    });

    // Persist game state
    await this.gameService.updateGame(game);

    return ThemeEliminateLogic.buildTimeoutResult({
      game,
      themeId: mutationResult.theme.id!,
      mutationResult,
      transitionResult,
    });
  }

  /**
   * Handle bidding timeout - auto-submit minimum bids for players who haven't bid.
   *
   * Uses BiddingTimeoutLogic for auto-bid processing,
   * then attempts phase transition via PhaseTransitionRouter.
   */
  public async handleBiddingTimeout(
    gameId: string
  ): Promise<BiddingTimeoutResult> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game || game.gameState.questionState !== QuestionState.BIDDING) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    if (!finalRoundData) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    // Process timeout bids via Logic class
    const mutationResult = BiddingTimeoutLogic.processTimeout(game);

    // Try phase transition (BIDDING → ANSWERING)
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.TIMER_EXPIRED,
      triggeredBy: { isSystem: true },
    });

    // Transition must succeed for bidding timeout (all bids now submitted)
    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    // Persist game state
    await this.gameService.updateGame(game);

    return BiddingTimeoutLogic.buildResult({
      game,
      mutationResult,
      transitionResult,
    });
  }

  /**
   * Process auto-loss answers when answering time expires.
   *
   * Uses AutoLossProcessLogic for pure mutation logic.
   */
  public async processAutoLossAnswers(
    gameId: string
  ): Promise<AutoLossProcessResult> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game || game.gameState.questionState !== QuestionState.ANSWERING) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    if (!finalRoundData) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    // Use Logic class for pure mutation
    const mutationResult = AutoLossProcessLogic.processAutoLoss(game);

    // Try phase transition (ANSWERING -> REVIEWING) if now complete
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.TIMER_EXPIRED,
      triggeredBy: { isSystem: true },
    });

    await this.gameService.updateGame(game);

    return AutoLossProcessLogic.buildResult({
      game,
      mutationResult,
      transitionResult,
    });
  }

  /**
   * Initialize bidding phase with automatic bids and check for immediate transition.
   *
   * Uses BiddingInitializationLogic for pure mutation logic.
   */
  public async initializeBiddingPhase(
    gameId: string
  ): Promise<BiddingPhaseInitializationResult> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game) {
      throw new ClientError(ClientResponse.GAME_NOT_FOUND);
    }

    // Use Logic class for pure mutation (automatic bids for low-score players)
    const mutationResult =
      BiddingInitializationLogic.processAutomaticBids(game);

    // Attempt immediate transition (BIDDING -> ANSWERING) if all bids are now present
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.CONDITION_MET,
      triggeredBy: { isSystem: true },
    });

    await this.gameService.updateGame(game);

    return BiddingInitializationLogic.buildResult({
      game,
      mutationResult,
      transitionResult,
    });
  }

  // Private helper methods

  private _getFinalRoundHandler(_game: Game): FinalRoundHandler {
    return this.roundHandlerFactory.create(
      PackageRoundType.FINAL
    ) as FinalRoundHandler;
  }
}

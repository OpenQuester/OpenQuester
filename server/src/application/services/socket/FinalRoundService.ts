import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { FINAL_ROUND_BID_TIME } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
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
import {
  AnswerReviewMutationResult,
  FinalAnswerReviewLogic,
} from "domain/state-machine/logic/FinalAnswerReviewLogic";
import {
  TransitionResult,
  TransitionTrigger,
} from "domain/state-machine/types";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { FinalAnswerReviewInputData } from "domain/types/socket/events/FinalAnswerReviewData";
import { BiddingPhaseInitializationResult } from "domain/types/socket/events/FinalRoundEventData";
import {
  AnswerReviewData,
  AutoLossProcessResult,
  BiddingTimeoutResult,
  FinalAnswerReviewResult,
  FinalAnswerSubmitResult,
  FinalBidSubmitResult,
  FinalRoundQuestionData,
  ThemeEliminateResult,
  ThemeEliminationTimeoutResult,
} from "domain/types/socket/finalround/FinalRoundResults";
import { QuestionAnswerData } from "domain/types/socket/finalround/QuestionAnswerData";
import { FinalRoundPhaseCompletionHelper } from "domain/utils/FinalRoundPhaseCompletionHelper";
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
    private readonly socketQuestionStateService: SocketQuestionStateService,
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
    const { nextPlayerId } = ThemeEliminateLogic.eliminateTheme(
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

    // Build result
    let timer: GameStateTimerDTO | undefined;
    if (transitionResult?.success && transitionResult.data?.timer) {
      timer = transitionResult.data.timer as GameStateTimerDTO;
    }

    return {
      game,
      eliminatedBy: currentPlayer!.meta.id,
      themeId,
      nextPlayerId: transitionResult?.success ? null : nextPlayerId,
      isPhaseComplete: transitionResult?.success ?? false,
      timer,
      transitionResult,
    };
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

    return FinalBidSubmitLogic.buildResult(
      game,
      currentPlayer.meta.id,
      normalizedBid,
      transitionResult
    );
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

    return FinalAnswerSubmitLogic.buildResult(
      game,
      player,
      mutationResult,
      completionResult,
      transitionResult
    );
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

    // Build result
    return this._buildAnswerReviewResult(
      game,
      mutationResult,
      transitionResult
    );
  }

  /**
   * Build the answer review result from mutation and transition results.
   */
  private _buildAnswerReviewResult(
    game: Game,
    mutationResult: AnswerReviewMutationResult,
    transitionResult: TransitionResult | null
  ): FinalAnswerReviewResult {
    let isGameFinished = false;
    let questionAnswerData: QuestionAnswerData | undefined;

    // Check if game finished from transition
    if (transitionResult?.data?.isGameFinished) {
      isGameFinished = true;
      questionAnswerData = transitionResult.data
        .questionAnswerData as QuestionAnswerData;
    }

    return {
      game,
      isGameFinished,
      reviewResult: mutationResult.reviewResult,
      allReviews: mutationResult.allReviews,
      questionAnswerData,
    };
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

    return {
      game,
      themeId: mutationResult.theme.id!,
      nextPlayerId: mutationResult.nextPlayerId,
      isPhaseComplete: transitionResult !== null,
      timer: transitionResult?.data?.timer as GameStateTimerDTO | undefined,
    };
  }

  /**
   * Handle bidding timeout - set bid to 1 for players who haven't submitted
   *
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
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    // Persist game state
    await this.gameService.updateGame(game);

    // Get question data from transition result
    const questionData = transitionResult.data
      ?.questionData as FinalRoundQuestionData;
    const timer = transitionResult.data?.timer as GameStateTimerDTO;

    return {
      game,
      timeoutBids: mutationResult.timeoutBids,
      questionData,
      timer,
    };
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
    const result = AutoLossProcessLogic.processAutoLoss(game);

    // Transform entries to review data format
    const autoLossReviews: AnswerReviewData[] = result.autoLossEntries.map(
      (entry) =>
        FinalRoundPhaseCompletionHelper.createAnswerReviewData(
          entry.answerData,
          entry.scoreChange,
          false
        )
    );

    let allReviews: AnswerReviewData[] | undefined;
    if (result.isPhaseComplete) {
      FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.REVIEWING);
      // Get all reviews for showman when transitioning to review phase
      allReviews = FinalRoundPhaseCompletionHelper.getAllAnswerReviews(game);
    }

    await this.gameService.updateGame(game);

    return {
      game,
      autoLossReviews,
      isReadyForReview: result.isPhaseComplete,
      allReviews,
    };
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
    const result = BiddingInitializationLogic.processAutomaticBids(game);

    if (result.allPlayersHaveAutomaticBids) {
      // Clear any existing timer before phase transition
      await this.gameService.clearTimer(game.id);

      // Immediate transition to question phase
      FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.ANSWERING);

      // Get question data
      const finalRoundHandler = this._getFinalRoundHandler(game);
      const remainingTheme = finalRoundHandler.getRemainingTheme(game);

      let questionData: FinalRoundQuestionData | undefined;
      if (
        remainingTheme &&
        remainingTheme.questions &&
        remainingTheme.questions.length > 0
      ) {
        questionData = {
          themeId: remainingTheme.id,
          themeName: remainingTheme.name,
          question: remainingTheme.questions[0],
        } satisfies FinalRoundQuestionData;
      }

      // Start answer timer
      const timer = await this._setupAnswerTimer(game);

      await this.gameService.updateGame(game);

      return {
        automaticBids: result.automaticBids,
        questionData,
        timer,
      } satisfies BiddingPhaseInitializationResult;
    } else {
      // Some players need to bid manually, set up bidding timer
      const timer = await this._setupBiddingTimer(game);

      await this.gameService.updateGame(game);

      return {
        automaticBids: result.automaticBids,
        timer,
      } satisfies BiddingPhaseInitializationResult;
    }
  }

  // Private helper methods

  /**
   * Get the package question data by theme ID from the final round
   */
  private _getPackageQuestionByThemeId(game: Game, themeId: number) {
    const finalRound = game.package.rounds.find(
      (round) => round.type === PackageRoundType.FINAL
    );
    if (!finalRound) {
      return null;
    }

    const theme = finalRound.themes.find((theme) => theme.id === themeId);
    if (!theme || !theme.questions || theme.questions.length === 0) {
      return null;
    }

    return theme.questions[0]; // Final round themes have only one question
  }

  private _getFinalRoundHandler(_game: Game): FinalRoundHandler {
    return this.roundHandlerFactory.create(
      PackageRoundType.FINAL
    ) as FinalRoundHandler;
  }

  private _initializeFinalRoundDataIfNeeded(game: Game): void {
    if (!FinalRoundStateManager.getFinalRoundData(game)) {
      FinalRoundStateManager.initializeFinalRoundData(game);
    }
  }

  private async _setupBiddingTimer(game: Game): Promise<GameStateTimerDTO> {
    const timer = await this.socketQuestionStateService.setupQuestionTimer(
      game,
      FINAL_ROUND_BID_TIME,
      QuestionState.BIDDING
    );
    return timer.value()!;
  }

  private async _setupAnswerTimer(game: Game): Promise<GameStateTimerDTO> {
    const timer = await this.socketQuestionStateService.setupFinalAnswerTimer(
      game
    );
    return timer.value()!;
  }
}

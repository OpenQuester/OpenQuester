import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { FINAL_ROUND_BID_TIME } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { FinalAnswerType } from "domain/enums/FinalRoundTypes";
import { ClientError } from "domain/errors/ClientError";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalRoundHandler } from "domain/handlers/socket/round/FinalRoundHandler";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { FinalAnswerReviewInputData } from "domain/types/socket/events/FinalAnswerReviewData";
import {
  BiddingPhaseInitializationResult,
  PlayerBidData,
} from "domain/types/socket/events/FinalRoundEventData";
import {
  AnswerData,
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
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { FinalRoundValidator } from "domain/validators/FinalRoundValidator";
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
    private readonly roundHandlerFactory: RoundHandlerFactory
  ) {
    //
  }

  /**
   * Handle theme elimination with automatic timer progression
   */
  public async handleThemeEliminate(
    socketId: string,
    themeId: number
  ): Promise<ThemeEliminateResult> {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    GameStateValidator.validateGameInProgress(game);

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    FinalRoundValidator.validateThemeEliminationPlayer(currentPlayer);
    FinalRoundValidator.validateThemeEliminationPhase(game);

    const finalRoundHandler = this._getFinalRoundHandler(game);

    // Get or initialize turn order
    let turnOrder = game.gameState.finalRoundData!.turnOrder;
    if (!turnOrder || turnOrder.length === 0) {
      turnOrder = finalRoundHandler.initializeTurnOrder(game);
      game.gameState.finalRoundData!.turnOrder = turnOrder;
    }

    if (
      currentPlayer.role !== PlayerRole.SHOWMAN &&
      !finalRoundHandler.isPlayerTurn(game, currentPlayer.meta.id, turnOrder)
    ) {
      throw new ClientError(ClientResponse.NOT_YOUR_TURN);
    }

    // Validate theme exists and isn't eliminated
    const theme = game.gameState.currentRound!.themes.find(
      (t) => t.id === themeId
    );
    if (!theme) {
      throw new ClientError(ClientResponse.THEME_NOT_FOUND);
    }

    if (theme.questions?.some((q) => q.isPlayed)) {
      throw new ClientError(ClientResponse.THEME_ALREADY_ELIMINATED);
    }

    const activeThemes = finalRoundHandler.getActiveThemes(game);
    if (activeThemes.length <= 1) {
      throw new ClientError(ClientResponse.CANNOT_ELIMINATE_LAST_THEME);
    }

    // Mark theme as eliminated
    if (theme.questions && theme.questions.length > 0) {
      theme.questions[0].isPlayed = true;
    }

    // Update final round data
    this._initializeFinalRoundDataIfNeeded(game);
    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game)!;
    finalRoundData.eliminatedThemes.push(themeId);

    let nextPlayerId: number | null = null;
    let isPhaseComplete = false;
    let timer: GameStateTimerDTO | undefined;

    // Check if elimination is complete
    if (finalRoundHandler.isThemeEliminationComplete(game)) {
      // Clear any existing timer before phase transition
      await this.gameService.clearTimer(game.id);

      // Transition to bidding phase
      FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.BIDDING);
      isPhaseComplete = true;

      // Initialize bidding phase will be handled by the event handler
      // to emit automatic bids and start timer
      timer = await this._setupBiddingTimer(game);
    } else {
      // Get next player's turn
      const currentTurnPlayer = finalRoundHandler.getCurrentTurnPlayer(
        game,
        turnOrder
      );
      if (currentTurnPlayer !== null) {
        game.gameState.currentTurnPlayerId = currentTurnPlayer;
        nextPlayerId = currentTurnPlayer;
      }
    }

    FinalRoundStateManager.updateFinalRoundData(game, finalRoundData);
    await this.gameService.updateGame(game);

    return {
      game,
      eliminatedBy: currentPlayer.meta.id,
      themeId,
      nextPlayerId,
      isPhaseComplete,
      timer,
    };
  }

  /**
   * Handle bidding submission with automatic timer progression
   */
  public async handleFinalBidSubmit(
    socketId: string,
    bid: number
  ): Promise<FinalBidSubmitResult> {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    GameStateValidator.validateGameInProgress(game);

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    FinalRoundValidator.validateFinalRoundPlayer(currentPlayer);
    FinalRoundValidator.validateBiddingPhase(game);

    // Normalize bid
    const normalizedBid = FinalRoundStateManager.validateAndNormalizeBid(
      game,
      currentPlayer.meta.id,
      bid
    );

    // Add bid
    FinalRoundStateManager.addBid(game, currentPlayer.meta.id, normalizedBid);

    let isPhaseComplete = false;
    let questionData: FinalRoundQuestionData | undefined;
    let timer: GameStateTimerDTO | undefined;

    // Check if all bids submitted
    if (FinalRoundStateManager.areAllBidsSubmitted(game)) {
      // Clear any existing timer before phase transition
      await this.gameService.clearTimer(game.id);

      // Transition to answering phase
      FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.ANSWERING);
      isPhaseComplete = true;

      // Get question data for the remaining theme
      const finalRoundHandler = this._getFinalRoundHandler(game);
      const remainingTheme = finalRoundHandler.getRemainingTheme(game);
      if (
        remainingTheme &&
        remainingTheme.questions &&
        remainingTheme.questions.length > 0
      ) {
        questionData = {
          themeId: remainingTheme.id,
          themeName: remainingTheme.name,
          question: remainingTheme.questions[0],
        };
      }

      // Start answer timer
      timer = await this._setupAnswerTimer(game);
    }

    await this.gameService.updateGame(game);

    return {
      game,
      playerId: currentPlayer.meta.id,
      bidAmount: normalizedBid,
      isPhaseComplete,
      questionData,
      timer,
    };
  }

  /**
   * Handle answer submission
   */
  public async handleFinalAnswerSubmit(
    socketId: string,
    answerText: string
  ): Promise<FinalAnswerSubmitResult> {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

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

    const trimmedAnswer = answerText?.trim() || "";
    const isAutoLoss = trimmedAnswer.length === 0;

    // Add answer
    FinalRoundStateManager.addAnswer(game, player.meta.id, trimmedAnswer);

    let isPhaseComplete = false;
    let allReviews: AnswerReviewData[] | undefined;

    // Check if all answers submitted
    if (FinalRoundStateManager.areAllAnswersSubmitted(game)) {
      // Clear any existing timer before phase transition
      await this.gameService.clearTimer(game.id);

      FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.REVIEWING);
      isPhaseComplete = true;

      // Get all reviews when transitioning to reviewing phase
      allReviews = this._getAllAnswerReviews(game);
    }

    await this.gameService.updateGame(game);

    return {
      game,
      playerId: player.meta.id,
      isPhaseComplete,
      isAutoLoss,
      allReviews,
    };
  }

  /**
   * Handle answer review with auto-loss processing
   */
  public async handleFinalAnswerReview(
    socketId: string,
    answerData: FinalAnswerReviewInputData
  ): Promise<FinalAnswerReviewResult> {
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
    FinalRoundValidator.validateReviewingPhase(game);

    // Review answer
    const { answer, scoreChange } = FinalRoundStateManager.reviewAnswer(
      game,
      answerData.answerId,
      answerData.isCorrect
    );

    let isGameFinished = false;
    let allReviews: AnswerReviewData[] | undefined;
    let questionAnswerData: QuestionAnswerData | undefined;

    // Check if all answers reviewed
    if (FinalRoundStateManager.areAllAnswersReviewed(game)) {
      const roundHandler = this.roundHandlerFactory.createFromGame(game);
      const result = await roundHandler.handleRoundProgression(game, {
        forced: true,
      });
      isGameFinished = result.isGameFinished;

      // Get all reviews for showman when phase is complete
      allReviews = this._getAllAnswerReviews(game);

      // If game is finished, include the question answer data
      if (isGameFinished) {
        const finalRoundHandler = this._getFinalRoundHandler(game);
        const remainingTheme = finalRoundHandler.getRemainingTheme(game);
        if (remainingTheme && remainingTheme.id && remainingTheme.name) {
          // Get the full question data from the package
          const packageQuestion = this._getPackageQuestionByThemeId(
            game,
            remainingTheme.id
          );
          if (packageQuestion) {
            questionAnswerData = {
              themeId: remainingTheme.id,
              themeName: remainingTheme.name,
              questionText: packageQuestion.text || undefined,
              answerText: packageQuestion.answerText || undefined,
            };
          }
        }
      }
    }

    await this.gameService.updateGame(game);

    const reviewResult = this._createAnswerReviewData(
      answer,
      scoreChange,
      answerData.isCorrect
    );

    return {
      game,
      isGameFinished,
      reviewResult,
      allReviews,
      questionAnswerData,
    };
  }

  /**
   * Handle theme elimination timeout - randomly eliminate a theme
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
    const activeThemes = finalRoundHandler.getActiveThemes(game);

    if (activeThemes.length <= 1) {
      throw new ClientError(ClientResponse.CANNOT_ELIMINATE_LAST_THEME);
    }

    // Randomly select theme to eliminate
    const randomIndex = Math.floor(Math.random() * activeThemes.length);
    const themeToEliminate = activeThemes[randomIndex];

    // Mark theme as eliminated
    if (themeToEliminate.questions && themeToEliminate.questions.length > 0) {
      themeToEliminate.questions[0].isPlayed = true;
    }

    // Update final round data
    this._initializeFinalRoundDataIfNeeded(game);
    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game)!;
    finalRoundData.eliminatedThemes.push(themeToEliminate.id!);

    let nextPlayerId: number | null = null;
    let isPhaseComplete = false;
    let timer: GameStateTimerDTO | undefined;

    if (finalRoundHandler.isThemeEliminationComplete(game)) {
      // Clear any existing timer before phase transition
      await this.gameService.clearTimer(game.id);

      FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.BIDDING);
      isPhaseComplete = true;
      timer = await this._setupBiddingTimer(game);
    } else {
      const turnOrder = finalRoundData.turnOrder;
      const currentTurnPlayer = finalRoundHandler.getCurrentTurnPlayer(
        game,
        turnOrder
      );
      if (currentTurnPlayer !== null) {
        game.gameState.currentTurnPlayerId = currentTurnPlayer;
        nextPlayerId = currentTurnPlayer;
      }
    }

    FinalRoundStateManager.updateFinalRoundData(game, finalRoundData);
    await this.gameService.updateGame(game);

    return {
      game,
      themeId: themeToEliminate.id!,
      nextPlayerId,
      isPhaseComplete,
      timer,
    };
  }

  /**
   * Handle bidding timeout - set bid to 1 for players who haven't submitted
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

    const timeoutBids: Array<PlayerBidData> = [];

    // Find players who haven't submitted bids and set them to 1
    const eligiblePlayers = game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );

    for (const player of eligiblePlayers) {
      if (finalRoundData.bids[player.meta.id] === undefined) {
        FinalRoundStateManager.addBid(game, player.meta.id, 1);
        timeoutBids.push({ playerId: player.meta.id, bidAmount: 1 });
      }
    }

    // Clear any existing timer before phase transition
    await this.gameService.clearTimer(game.id);

    // Transition to answering phase
    FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.ANSWERING);

    // Get question data
    const finalRoundHandler = this._getFinalRoundHandler(game);
    const remainingTheme = finalRoundHandler.getRemainingTheme(game);

    if (
      !remainingTheme ||
      !remainingTheme.id ||
      !remainingTheme.name ||
      !remainingTheme.questions?.[0]
    ) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    const questionData: FinalRoundQuestionData = {
      themeId: remainingTheme.id,
      themeName: remainingTheme.name,
      question: remainingTheme.questions[0],
    };

    // Start answer timer
    const timer = await this._setupAnswerTimer(game);

    await this.gameService.updateGame(game);

    return {
      game,
      timeoutBids,
      questionData,
      timer,
    };
  }

  /**
   * Process auto-loss answers when answering time expires
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

    const autoLossReviews: AnswerReviewData[] = [];

    // Find players who haven't submitted answers and create auto-loss entries
    const eligiblePlayers = game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );

    for (const player of eligiblePlayers) {
      const hasSubmitted = finalRoundData.answers.some(
        (answer) => answer.playerId === player.meta.id
      );

      if (!hasSubmitted) {
        // Add empty answer as auto-loss (automatically marked by StateManager)
        const answer = FinalRoundStateManager.addAnswer(
          game,
          player.meta.id,
          ""
        );

        // Create answer data (answer.autoLoss is true for empty answers)
        const answerData: AnswerData = {
          id: answer.id,
          playerId: answer.playerId,
          answer: answer.answer,
          autoLoss: answer.autoLoss,
        };

        // Immediately mark as incorrect and update score
        const { scoreChange } = FinalRoundStateManager.reviewAnswer(
          game,
          answer.id,
          false
        );

        const reviewData = this._createAnswerReviewData(
          answerData,
          scoreChange,
          false
        );
        autoLossReviews.push(reviewData);
      }
    }

    // Check if ready for review phase
    const isReadyForReview =
      FinalRoundStateManager.areAllAnswersSubmitted(game);

    let allReviews: AnswerReviewData[] | undefined;
    if (isReadyForReview) {
      FinalRoundStateManager.transitionToPhase(game, FinalRoundPhase.REVIEWING);
      // Get all reviews for showman when transitioning to review phase
      allReviews = this._getAllAnswerReviews(game);
    }

    await this.gameService.updateGame(game);

    return {
      game,
      autoLossReviews,
      isReadyForReview,
      allReviews,
    };
  }

  /**
   * Initialize bidding phase with automatic bids and check for immediate transition
   */
  public async initializeBiddingPhase(
    gameId: string
  ): Promise<BiddingPhaseInitializationResult> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game) {
      throw new ClientError(ClientResponse.GAME_NOT_FOUND);
    }

    const automaticBids: PlayerBidData[] = [];

    // Find players with score <= 1 and place automatic bids
    const eligiblePlayers = game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );

    for (const player of eligiblePlayers) {
      if (player.score <= 1) {
        FinalRoundStateManager.addBid(game, player.meta.id, 1);
        automaticBids.push({
          playerId: player.meta.id,
          bidAmount: 1,
        } satisfies PlayerBidData);
      }
    }

    // Check if all players have bids (all had score <= 1)
    const allPlayersHaveAutomaticBids = eligiblePlayers.every(
      (player) => player.score <= 1
    );

    if (allPlayersHaveAutomaticBids) {
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
        automaticBids,
        questionData,
        timer,
      } satisfies BiddingPhaseInitializationResult;
    } else {
      // Some players need to bid manually, set up bidding timer
      const timer = await this._setupBiddingTimer(game);

      await this.gameService.updateGame(game);

      return {
        automaticBids,
        timer,
      } satisfies BiddingPhaseInitializationResult;
    }
  }

  // Private helper methods

  /**
   * Create a standardized answer review data object with strict typing
   */
  private _createAnswerReviewData(
    answer: AnswerData,
    scoreChange: number,
    isCorrect: boolean
  ): AnswerReviewData {
    let answerType: FinalAnswerType;
    if (answer.autoLoss) {
      answerType = FinalAnswerType.AUTO_LOSS;
    } else if (isCorrect) {
      answerType = FinalAnswerType.CORRECT;
    } else {
      answerType = FinalAnswerType.WRONG;
    }

    return {
      playerId: answer.playerId,
      answerId: answer.id,
      answerText: answer.answer,
      scoreChange,
      answerType,
      isCorrect,
    };
  }

  /**
   * Get all answer reviews for the game (for showman)
   */
  private _getAllAnswerReviews(game: Game): AnswerReviewData[] {
    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    if (!finalRoundData) {
      return [];
    }

    return finalRoundData.answers.map((answer) => {
      const bidAmount = finalRoundData.bids[answer.playerId] || 0;

      // If answer is already reviewed, use that result
      if (answer.isCorrect !== undefined) {
        const scoreChange = answer.isCorrect ? bidAmount : -bidAmount;
        return this._createAnswerReviewData(
          answer,
          scoreChange,
          answer.isCorrect!
        );
      }

      // For unreviewed answers, create review data without score change
      return this._createAnswerReviewData(answer, 0, false);
    });
  }

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

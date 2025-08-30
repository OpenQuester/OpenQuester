import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import {
  GAME_QUESTION_ANSWER_SUBMIT_TIME,
  GAME_QUESTION_ANSWER_TIME,
  STAKE_QUESTION_BID_TIME,
} from "domain/constants/game";
import { REDIS_LOCK_QUESTION_ANSWER } from "domain/constants/redis";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ClientError } from "domain/errors/ClientError";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { StakeBiddingMapper } from "domain/mappers/StakeBiddingMapper";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";
import {
  StakeBidSubmitInputData,
  StakeBidType,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import {
  AnswerResultData,
  AnswerResultType,
} from "domain/types/socket/game/AnswerResultData";
import { SecretQuestionTransferInputData } from "domain/types/socket/game/SecretQuestionTransferData";
import { StakeBidSubmitResult } from "domain/types/socket/question/StakeQuestionResults";
import { SpecialQuestionUtils } from "domain/utils/QuestionUtils";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";
import { SecretQuestionValidator } from "domain/validators/SecretQuestionValidator";
import { StakeQuestionValidator } from "domain/validators/StakeQuestionValidator";
import { ILogger } from "infrastructure/logger/ILogger";

export class SocketIOQuestionService {
  constructor(
    private readonly gameService: GameService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly socketGameValidationService: SocketGameValidationService,
    private readonly socketQuestionStateService: SocketQuestionStateService,
    private readonly socketGameTimerService: SocketGameTimerService,
    private readonly roundHandlerFactory: RoundHandlerFactory,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly logger: ILogger
  ) {
    //
  }

  private _getQuestionAnswerLockKey(gameId: string) {
    return `${REDIS_LOCK_QUESTION_ANSWER}:${gameId}`;
  }

  public async handleQuestionAnswer(socketId: string) {
    // Context & Validation
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    QuestionActionValidator.validateAnswerAction({
      game,
      currentPlayer,
      action: QuestionAction.ANSWER,
    });

    // Execution
    const acquired = await this.gameService.gameLock(
      this._getQuestionAnswerLockKey(game.id),
      1
    );

    if (!acquired) {
      throw new ClientError(ClientResponse.SOMEONE_ALREADY_ANSWERING);
    }

    // Save showing timer to have timer restore point
    await this.socketGameTimerService.saveElapsedTimer(
      game,
      GAME_QUESTION_ANSWER_SUBMIT_TIME,
      QuestionState.SHOWING
    );

    const timer = await this.socketQuestionStateService.setupAnsweringTimer(
      game,
      GAME_QUESTION_ANSWER_SUBMIT_TIME,
      currentPlayer!.meta.id
    );

    return {
      userId: currentPlayer?.meta.id,
      gameId: game.id,
      timer,
    };
  }

  /**
   * TODO: Not implemented yet
   */
  public async handleAnswerSubmitted(socketId: string) {
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    GameStateValidator.validateGameInProgress(game);

    if (game.gameState.answeringPlayer !== currentPlayer?.meta.id) {
      throw new ClientError(ClientResponse.CANNOT_SUBMIT_ANSWER);
    }

    return game;
  }

  public async handleAnswerResult(socketId: string, data: AnswerResultData) {
    // Context & Validation
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    QuestionActionValidator.validateAnswerResultAction({
      game,
      currentPlayer,
      action: QuestionAction.RESULT,
    });

    // Execution
    const isCorrect = data.answerType === AnswerResultType.CORRECT;
    const nextState = isCorrect
      ? QuestionState.CHOOSING
      : QuestionState.SHOWING;

    const playerAnswerResult = game.handleQuestionAnswer(
      data.scoreResult,
      data.answerType,
      nextState
    );

    // Update player answer statistics for persistence
    try {
      await this.playerGameStatsService.updatePlayerAnswerStats(
        game.id,
        playerAnswerResult.player,
        data.answerType,
        playerAnswerResult.score
      );
    } catch (error) {
      // Log but don't throw - statistics shouldn't break game flow
      this.logger.warn("Failed to update player answer statistics", {
        prefix: "[SOCKET_QUESTION_SERVICE]: ",
        gameId: game.id,
        playerId: playerAnswerResult.player,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    let question = null;
    const correctAnswerSimpleRound =
      isCorrect &&
      game.gameState.currentRound?.type === PackageRoundType.SIMPLE;

    if (correctAnswerSimpleRound) {
      // Update current turn player ID to the one who answered correctly
      const answeringPlayerId = playerAnswerResult.player;
      game.gameState.currentTurnPlayerId = answeringPlayerId;
    }

    // Same logic for all rounds types
    if (isCorrect) {
      question = await this.getCurrentQuestion(game);

      // Mark question as played so round progression can happen
      const questionData = GameQuestionMapper.getQuestionAndTheme(
        game.package,
        game.gameState.currentRound!.id,
        question.id!
      );

      if (questionData) {
        GameQuestionMapper.setQuestionPlayed(
          game,
          question.id!,
          questionData.theme.id!
        );
      }

      game.gameState.currentQuestion = null;
    }

    let timer: GameStateTimerDTO | null = null;
    if (nextState === QuestionState.SHOWING) {
      timer = await this.gameService.getTimer(game.id, QuestionState.SHOWING);
    } else if (nextState === QuestionState.CHOOSING) {
      // For correct answers, properly reset to choosing state
      await this.socketQuestionStateService.resetToChoosingState(game);
    }

    game.setTimer(timer);

    // Save
    await this.gameService.updateGame(game);
    if (timer) {
      await this.gameService.saveTimer(
        timer,
        game.id,
        timer.durationMs - timer.elapsedMs
      );
    } else {
      // Always make sure all timers are cleared if not meant to be running
      await this.gameService.clearTimer(game.id);
    }

    // Release the question answer lock
    const lockKey = this._getQuestionAnswerLockKey(game.id);
    await this.gameService.gameUnlock(lockKey);

    return {
      playerAnswerResult,
      game,
      question,
      timer,
    };
  }

  public async handleRoundProgression(game: Game) {
    const roundHandler = this.roundHandlerFactory.createFromGame(game);
    const { isGameFinished, nextGameState } =
      await roundHandler.handleRoundProgression(game, { forced: false });

    if (isGameFinished || nextGameState) {
      await this.gameService.updateGame(game);
    }

    return { isGameFinished, nextGameState };
  }

  public async handleQuestionForceSkip(socketId: string) {
    // Context & Validation
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;
    const gameState = game.gameState;

    QuestionActionValidator.validateForceSkipAction({
      game,
      currentPlayer,
      action: QuestionAction.SKIP,
    });

    // Execution & Save
    let questionData;

    if (gameState.currentQuestion) {
      // Normal question flow
      questionData = GameQuestionMapper.getQuestionAndTheme(
        game.package,
        gameState.currentRound!.id,
        gameState.currentQuestion.id!
      );
    } else if (gameState.stakeQuestionData) {
      // Stake question flow - get question from stake data
      questionData = GameQuestionMapper.getQuestionAndTheme(
        game.package,
        gameState.currentRound!.id,
        gameState.stakeQuestionData.questionId
      );
    } else if (gameState.secretQuestionData) {
      // Secret question flow - get question from secret data
      questionData = GameQuestionMapper.getQuestionAndTheme(
        game.package,
        gameState.currentRound!.id,
        gameState.secretQuestionData.questionId
      );
    } else {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    if (!questionData?.question) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    // Mark question as played so round progression can happen
    GameQuestionMapper.setQuestionPlayed(
      game,
      questionData.question.id!,
      questionData.theme.id!
    );

    await this.socketQuestionStateService.resetToChoosingState(game);

    return { game, question: questionData.question };
  }

  public async handlePlayerSkip(socketId: string) {
    // Context & Validation
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    QuestionActionValidator.validatePlayerSkipAction({
      game,
      currentPlayer,
      action: QuestionAction.PLAYER_SKIP,
    });

    // Check if this skip should be treated as a "give up" with penalty
    if (SpecialQuestionUtils.isGiveUpScenario(game)) {
      return await this._handleGiveUp(game, currentPlayer!);
    }

    // Default skip behavior: just mark player as skipped
    return await this._handleRegularSkip(game, currentPlayer!);
  }

  public async handlePlayerUnskip(socketId: string) {
    // Context & Validation
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    QuestionActionValidator.validateUnskipAction({
      game,
      currentPlayer,
      action: QuestionAction.PLAYER_SKIP,
    });

    // Execution
    game.removeSkippedPlayer(currentPlayer!.meta.id);

    // Save
    await this.gameService.updateGame(game);

    return { game, playerId: currentPlayer!.meta.id };
  }

  public async handleQuestionPick(socketId: string, questionId: number) {
    // Context & Validation
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    QuestionActionValidator.validatePickAction({
      game,
      currentPlayer,
      action: QuestionAction.PICK,
    });

    const currentRound = game.gameState.currentRound!;

    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      currentRound.id,
      questionId
    );

    if (!questionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const { question, theme } = questionData;

    if (GameQuestionMapper.isQuestionPlayed(game, question.id!, theme.id!)) {
      throw new ClientError(ClientResponse.QUESTION_ALREADY_PLAYED);
    }

    // Execution
    let timer: GameStateTimer | null = null;
    let specialQuestionData:
      | SecretQuestionGameData
      | StakeQuestionGameData
      | null = null;
    let automaticNominalBid: PlayerBidData | null = null;

    if (question.type === PackageQuestionType.SECRET) {
      specialQuestionData = this._setupSecretQuestion(
        game,
        question,
        currentPlayer!
      );
      // If no special question data (no active players), proceed as normal question
      if (!specialQuestionData) {
        game.gameState.secretQuestionData = null;
        timer = await this.socketQuestionStateService.setupQuestionTimer(
          game,
          GAME_QUESTION_ANSWER_TIME,
          QuestionState.SHOWING
        );
        // For normal question fallback, set currentQuestion
        game.gameState.currentQuestion = GameQuestionMapper.mapToSimpleQuestion(
          questionData.question
        );
      }
    } else if (question.type === PackageQuestionType.STAKE) {
      const stakeSetupResult = await this._setupStakeQuestion(
        game,
        question,
        currentPlayer!
      );
      // If no stake setup result (no active players), proceed as normal question
      if (stakeSetupResult) {
        specialQuestionData = stakeSetupResult.stakeQuestionData;
        timer = stakeSetupResult.timer;
        automaticNominalBid = stakeSetupResult.automaticNominalBid;
      } else {
        game.gameState.stakeQuestionData = null;
        timer = await this.socketQuestionStateService.setupQuestionTimer(
          game,
          GAME_QUESTION_ANSWER_TIME,
          QuestionState.SHOWING
        );
        // For normal question fallback, set currentQuestion
        game.gameState.currentQuestion = GameQuestionMapper.mapToSimpleQuestion(
          questionData.question
        );
      }
    } else {
      // Normal question flow - set up timer and showing state
      timer = await this.socketQuestionStateService.setupQuestionTimer(
        game,
        GAME_QUESTION_ANSWER_TIME,
        QuestionState.SHOWING
      );
      // For normal questions, set currentQuestion immediately
      game.gameState.currentQuestion = GameQuestionMapper.mapToSimpleQuestion(
        questionData.question
      );
    }
    GameQuestionMapper.setQuestionPlayed(game, question.id!, theme.id!);

    // Save
    await this.gameService.updateGame(game);

    return {
      question,
      game,
      timer,
      specialQuestionData,
      automaticNominalBid,
    };
  }

  public async getCurrentQuestion(game: Game) {
    const gameState = game.gameState;

    if (!gameState.currentRound) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    if (!gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      gameState.currentRound.id,
      gameState.currentQuestion.id!
    );

    if (!questionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const { question } = questionData;

    return question;
  }

  /**
   * Returns a map of socket IDs to either full (for showman) or
   * simple (for others) question data
   */
  public async getPlayersBroadcastMap(
    socketsIds: string[],
    game: Game,
    question: PackageQuestionDTO
  ) {
    const fullQuestionPayload = question;
    const simpleQuestionPayload =
      GameQuestionMapper.mapToSimpleQuestion(question);

    // Map socketId to question payload
    const resultMap: Map<
      string,
      PackageQuestionDTO | SimplePackageQuestionDTO
    > = new Map();

    const log = this.logger.performance("Get players broadcast map", {
      prefix: "[SOCKET]: ",
      operationsCount: socketsIds.length,
    });

    // TODO: This probably can be rewritten in Redis pipeline if needed
    const userDataPromises = socketsIds.map((socketId) =>
      this.socketGameContextService
        .fetchUserSocketData(socketId)
        .then((userSession) => ({
          socketId,
          userSession,
        }))
    );

    const userDataResults = await Promise.all(userDataPromises);

    log.finish();

    for (const { socketId, userSession } of userDataResults) {
      const player = game.getPlayer(userSession.id, {
        fetchDisconnected: false,
      });

      if (player?.role === PlayerRole.SHOWMAN) {
        resultMap.set(socketId, fullQuestionPayload);
      } else {
        resultMap.set(socketId, simpleQuestionPayload);
      }
    }

    return resultMap;
  }

  public async getGameStateBroadcastMap(
    socketsIds: string[],
    game: Game,
    gameState: GameStateDTO
  ): Promise<Map<string, GameStateDTO>> {
    const resultMap = new Map<string, GameStateDTO>();

    const isFinalRound =
      gameState.currentRound?.type === PackageRoundType.FINAL;

    // If not final round, everyone gets same state
    if (!isFinalRound) {
      for (const socketId of socketsIds) {
        resultMap.set(socketId, gameState);
      }
      return resultMap;
    }

    const log = this.logger.performance("Get players broadcast map", {
      prefix: "[SOCKET]: ",
      operationsCount: socketsIds.length,
    });

    // TODO: This probably can be rewritten in Redis pipeline if needed
    const userDataPromises = socketsIds.map((socketId) =>
      this.socketGameContextService
        .fetchUserSocketData(socketId)
        .then((userSession) => ({
          socketId,
          userSession,
        }))
    );

    const userDataResults = await Promise.all(userDataPromises);

    log.finish();

    // For each socket, provide appropriate game state based on role
    for (const { socketId, userSession } of userDataResults) {
      const player = game.getPlayer(userSession.id, {
        fetchDisconnected: false,
      });

      if (player?.role === PlayerRole.SHOWMAN) {
        // Showman gets full data
        resultMap.set(socketId, gameState);
      } else {
        // Players and spectators get filtered data (no questions)
        const playerGameState = { ...gameState };

        // Only modify the currentRound part if it exists
        if (playerGameState.currentRound) {
          playerGameState.currentRound = {
            ...playerGameState.currentRound,
            themes: playerGameState.currentRound.themes.map((theme) => ({
              ...theme,
              questions: [], // Players get empty questions array
            })),
          };
        }

        resultMap.set(socketId, playerGameState);
      }
    }

    return resultMap;
  }

  /**
   * Handle automatic question skip when all players have skipped
   */
  public async handleAutomaticQuestionSkip(game: Game) {
    const gameState = game.gameState;

    // Basic validation - game must be in progress and have a current question
    GameStateValidator.validateGameInProgress(game);
    this.socketGameValidationService.validateQuestionSkipping(game);

    if (!gameState.currentQuestion) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      gameState.currentRound!.id,
      gameState.currentQuestion.id!
    );

    if (!questionData?.question) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    // Reset to choosing state
    await this.socketQuestionStateService.resetToChoosingState(game);

    return { game, question: questionData.question };
  }

  public async handleSecretQuestionTransfer(
    socketId: string,
    data: SecretQuestionTransferInputData
  ) {
    // Context & Validation
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    const secretData = game.gameState.secretQuestionData;
    SecretQuestionValidator.validateTransfer({
      game,
      currentPlayer,
      secretData: secretData ?? null,
      targetPlayerId: data.targetPlayerId,
    });

    // Execution
    const timer = await this.socketQuestionStateService.setupQuestionTimer(
      game,
      GAME_QUESTION_ANSWER_TIME,
      QuestionState.ANSWERING
    );

    // Get the question data from the secret question data
    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      game.gameState.currentRound!.id,
      secretData!.questionId
    );

    if (!questionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    // Set currentQuestion now that the question is being transferred and shown
    game.gameState.currentQuestion = GameQuestionMapper.mapToSimpleQuestion(
      questionData.question
    );

    game.gameState.secretQuestionData = null;
    game.gameState.questionState = QuestionState.ANSWERING;
    // Set the target player as the answering player
    game.gameState.answeringPlayer = data.targetPlayerId;

    // Save
    await this.gameService.updateGame(game);

    return {
      game,
      fromPlayerId: currentPlayer!.meta.id,
      toPlayerId: data.targetPlayerId,
      questionId: secretData!.questionId,
      timer,
    };
  }

  public async handleStakeBidSubmit(
    socketId: string,
    inputData: StakeBidSubmitInputData
  ): Promise<StakeBidSubmitResult> {
    const bid: number | StakeBidType =
      inputData.bidType === StakeBidType.NORMAL && inputData.bidAmount !== null
        ? inputData.bidAmount
        : inputData.bidType;

    // Context & Validation
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    StakeQuestionValidator.validateBidSubmission({
      game,
      currentPlayer,
      stakeData: game.gameState.stakeQuestionData ?? null,
    });

    // Execution
    const stakeData = game.gameState.stakeQuestionData!;

    // For stake questions, get question using the questionId from stake data
    // Because currentQuestion is not set to gameState while bidding phase
    const stakeQuestionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      game.gameState.currentRound!.id,
      stakeData.questionId
    );

    if (!stakeQuestionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const question = stakeQuestionData.question;
    const allPlayers = game.getInGamePlayers().map((player) => player.toDTO());

    const bidResult = StakeBiddingMapper.placeBid({
      playerId: currentPlayer!.meta.id,
      bid,
      stakeData,
      currentPlayer: currentPlayer!.toDTO(),
      questionPrice: question.price || 1, // Default to 1 if somehow price is null
      allPlayers,
    });

    game.gameState.stakeQuestionData = bidResult.updatedStakeData;

    const bidType = bidResult.bidType;
    const bidAmount = bidResult.bidAmount;
    const isPhaseComplete = bidResult.isPhaseComplete ?? false;
    const nextBidderId = bidResult.nextBidderId ?? null;

    const { questionData, timer } = await this._handleStakeBidTimers(
      game,
      isPhaseComplete,
      bidResult.updatedStakeData.winnerPlayerId,
      nextBidderId
    );

    // Save
    await this.gameService.updateGame(game);

    return {
      game,
      playerId: currentPlayer!.meta.id,
      bidAmount,
      bidType,
      isPhaseComplete,
      nextBidderId,
      winnerPlayerId: bidResult.updatedStakeData.winnerPlayerId,
      questionData: questionData
        ? GameQuestionMapper.mapToSimpleQuestion(questionData)
        : null,
      timer,
    };
  }

  /**
   * Determines if an auto-bid should immediately end the bidding phase
   * This happens when:
   * 1. Auto-bid reaches maxPrice, OR
   * 2. No other players can afford to outbid the auto-bid amount
   */
  private shouldAutoBidEndBidding(
    stakeQuestionData: StakeQuestionGameData,
    autoBidAmount: number,
    allPlayers: PlayerDTO[]
  ): boolean {
    // If auto-bid reaches maxPrice, bidding ends immediately
    if (
      stakeQuestionData.maxPrice !== null &&
      autoBidAmount >= stakeQuestionData.maxPrice
    ) {
      return true;
    }

    // Check if any other players can afford to outbid the auto-bid
    const otherPlayerIds = stakeQuestionData.biddingOrder.filter(
      (playerId) => playerId !== stakeQuestionData.pickerPlayerId
    );

    for (const playerId of otherPlayerIds) {
      const player = allPlayers.find((p) => p.meta.id === playerId);
      if (player) {
        // Check if player can make a bid higher than auto-bid
        const minimumOutbid = autoBidAmount + 1;
        if (player.score >= minimumOutbid) {
          // This player can afford to outbid - bidding should continue
          return false;
        }
      }
    }

    // No other players can afford to outbid - auto-bid wins
    return true;
  }

  /**
   * Sets up secret question data and game state
   * Returns null if no active players exist (only showman), causing question to proceed as normal
   */
  private _setupSecretQuestion(
    game: Game,
    question: PackageQuestionDTO,
    currentPlayer: Player
  ): SecretQuestionGameData | null {
    // Check if there are any active in-game players to transfer to
    const activeInGamePlayers = game.getInGamePlayers();
    if (activeInGamePlayers.length === 0) {
      // No active players to transfer to, skip secret transfer phase
      return null;
    }

    const secretQuestionData = {
      pickerPlayerId: currentPlayer.meta.id,
      transferType: question.transferType!,
      questionId: question.id!,
      transferPhase: true,
    } satisfies SecretQuestionGameData;

    // Set the game state to secret transfer phase
    game.gameState.questionState = QuestionState.SECRET_TRANSFER;
    game.gameState.secretQuestionData = secretQuestionData;

    return secretQuestionData;
  }

  /**
   * Sets up stake question data, bidding order, and handles automatic bidding logic
   * Returns null if no active players exist (only showman), causing question to proceed as normal
   */
  private async _setupStakeQuestion(
    game: Game,
    question: PackageQuestionDTO,
    currentPlayer: Player
  ) {
    const eligiblePlayers = game.players.filter(
      (p) =>
        p.role === PlayerRole.PLAYER &&
        p.gameStatus === PlayerGameStatus.IN_GAME
    );

    // Check if there are any active in-game players to bid
    if (eligiblePlayers.length === 0) {
      // No active players to bid, skip stake bidding phase
      return null;
    }

    // Create bidding order (picker goes first)
    const pickerIndex = eligiblePlayers.findIndex(
      (p) => p.meta.id === currentPlayer.meta.id
    );

    // Create bidding order: picker first, then remaining players in order
    // Example: if picker is player 3 in [1,2,3,4], order becomes [3,4,1,2]
    const biddingOrder = [
      ...eligiblePlayers.slice(pickerIndex),
      ...eligiblePlayers.slice(0, pickerIndex),
    ].map((p) => p.meta.id);

    // Set up stake question data
    const stakeQuestionData: StakeQuestionGameData = {
      pickerPlayerId: currentPlayer.meta.id,
      questionId: question.id!,
      maxPrice: question.maxPrice ?? null,
      bids: {},
      passedPlayers: [],
      biddingOrder,
      currentBidderIndex: 0,
      highestBid: null,
      winnerPlayerId: null,
      biddingPhase: true,
    };

    // Set the game state to bidding phase
    game.gameState.questionState = QuestionState.BIDDING;
    game.gameState.stakeQuestionData = stakeQuestionData;

    // Setup bidding timer
    const timer = await this.socketQuestionStateService.setupQuestionTimer(
      game,
      STAKE_QUESTION_BID_TIME,
      QuestionState.BIDDING
    );

    let automaticNominalBid: PlayerBidData | null = null;

    // Check if picker has insufficient score for automatic nominal bid
    const nominalBidAmount = question.price ?? 1;

    if (currentPlayer.score < nominalBidAmount) {
      automaticNominalBid = this._handleAutomaticBid(
        stakeQuestionData,
        currentPlayer,
        game.players.map((player) => player.toDTO()),
        nominalBidAmount
      );
    }

    return { stakeQuestionData, timer, automaticNominalBid };
  }

  /**
   * Handles automatic bidding when player cannot afford nominal bid
   */
  private _handleAutomaticBid(
    stakeQuestionData: StakeQuestionGameData,
    currentPlayer: Player,
    allPlayers: PlayerDTO[],
    questionPrice: number
  ): PlayerBidData {
    // Player cannot afford nominal bid - automatically bid the question price
    const autoBidAmount = questionPrice;
    stakeQuestionData.bids[currentPlayer.meta.id] = autoBidAmount;
    stakeQuestionData.highestBid = autoBidAmount;
    stakeQuestionData.winnerPlayerId = currentPlayer.meta.id;

    // Check if auto-bid should immediately end bidding phase
    const shouldEndBidding = this.shouldAutoBidEndBidding(
      stakeQuestionData,
      autoBidAmount,
      allPlayers
    );

    if (shouldEndBidding) {
      stakeQuestionData.biddingPhase = false;
      stakeQuestionData.currentBidderIndex = 0;
    } else {
      // Move to next bidder for continuation
      // Increment current bidder index with circular rotation
      stakeQuestionData.currentBidderIndex =
        (stakeQuestionData.currentBidderIndex + 1) %
        stakeQuestionData.biddingOrder.length;
    }

    return {
      playerId: currentPlayer.meta.id,
      bidAmount: autoBidAmount,
    };
  }

  /**
   * Handles timer setup for stake bid submissions based on phase completion
   * - If bidding is complete, starts the answer phase timer
   * - If there's a next bidder, sets up the timer for the next bid
   */
  private async _handleStakeBidTimers(
    game: Game,
    isPhaseComplete: boolean,
    winnerPlayerId: number | null,
    nextBidderId: number | null
  ) {
    let questionData: PackageQuestionDTO | undefined;
    let timer: GameStateTimerDTO | undefined;

    // If bidding is complete, start the answer phase
    if (isPhaseComplete && winnerPlayerId) {
      // Clear any existing timer
      await this.gameService.clearTimer(game.id);

      game.gameState.questionState = QuestionState.SHOWING;
      // For stake questions, answeringPlayer should be null during SHOWING phase
      // It will be set when someone actually attempts to answer
      game.gameState.answeringPlayer = null;

      // Get the question data from stake question data
      const stakeData = game.gameState.stakeQuestionData;
      if (stakeData) {
        const questionAndTheme = GameQuestionMapper.getQuestionAndTheme(
          game.package,
          game.gameState.currentRound!.id,
          stakeData.questionId
        );

        if (questionAndTheme) {
          // Set currentQuestion now that bidding is complete and question is being shown
          game.gameState.currentQuestion =
            GameQuestionMapper.mapToSimpleQuestion(questionAndTheme.question);
          questionData = questionAndTheme.question;
        }
      }

      const timerEntity =
        await this.socketQuestionStateService.setupQuestionTimer(
          game,
          GAME_QUESTION_ANSWER_TIME,
          QuestionState.SHOWING
        );

      timer = timerEntity.start();
    } else if (nextBidderId !== null) {
      // If there's a next bidder, set up timer for next bid (30 seconds)
      await this.gameService.clearTimer(game.id);

      // Setup timer for next bid
      const timerEntity =
        await this.socketQuestionStateService.setupQuestionTimer(
          game,
          STAKE_QUESTION_BID_TIME,
          QuestionState.BIDDING
        );

      timer = timerEntity.start();
    }

    return { questionData, timer };
  }

  /**
   * Handles give up scenario: applies penalty and transitions to SHOWING
   */
  private async _handleGiveUp(game: Game, currentPlayer: Player) {
    // Calculate penalty based on current question price
    const penalty = SpecialQuestionUtils.calculateGiveUpPenalty(game);

    // Set up game state for wrong answer
    game.gameState.answeringPlayer = currentPlayer.meta.id;
    this._clearSpecialQuestionData(game);

    // Process the wrong answer
    const playerAnswerResult = game.handleQuestionAnswer(
      penalty,
      AnswerResultType.WRONG,
      QuestionState.SHOWING
    );

    // Update statistics
    await this._updatePlayerStatsForGiveUp(game, playerAnswerResult);

    // Set up timer for SHOWING state
    const timer = await this._setupShowingTimer(game);

    // Save game state
    await this.gameService.updateGame(game);
    await this.gameService.saveTimer(timer, game.id);

    return {
      game,
      playerId: currentPlayer.meta.id,
      gaveUp: true as const,
      answerResult: playerAnswerResult,
      timer,
    };
  }

  /**
   * Handles regular skip: just marks player as skipped
   */
  private async _handleRegularSkip(game: Game, currentPlayer: Player) {
    game.addSkippedPlayer(currentPlayer.meta.id);
    await this.gameService.updateGame(game);

    return {
      game,
      playerId: currentPlayer.meta.id,
      gaveUp: false as const,
    };
  }

  /**
   * Clears special question data based on current state
   */
  private _clearSpecialQuestionData(game: Game): void {
    if (game.gameState.secretQuestionData) {
      game.gameState.secretQuestionData = null;
    }
    if (game.gameState.stakeQuestionData) {
      game.gameState.stakeQuestionData = null;
    }
  }

  /**
   * Updates player statistics for give up scenario
   */
  private async _updatePlayerStatsForGiveUp(
    game: Game,
    playerAnswerResult: { player: number; score: number }
  ): Promise<void> {
    try {
      await this.playerGameStatsService.updatePlayerAnswerStats(
        game.id,
        playerAnswerResult.player,
        AnswerResultType.WRONG,
        playerAnswerResult.score
      );
    } catch (error) {
      this.logger.warn("Failed to update player answer statistics on give up", {
        prefix: "[SOCKET_QUESTION_SERVICE]: ",
        gameId: game.id,
        playerId: playerAnswerResult.player,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Sets up timer for SHOWING state after give up
   */
  private async _setupShowingTimer(game: Game): Promise<GameStateTimerDTO> {
    await this.gameService.clearTimer(game.id);

    const timerEntity =
      await this.socketQuestionStateService.setupQuestionTimer(
        game,
        GAME_QUESTION_ANSWER_TIME,
        QuestionState.SHOWING
      );

    const timer = timerEntity.start();
    game.setTimer(timer);

    return timer;
  }
}

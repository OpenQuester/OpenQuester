import { GameService } from "application/services/game/GameService";
import { SpecialQuestionService } from "application/services/question/SpecialQuestionService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import {
  GAME_QUESTION_ANSWER_SUBMIT_TIME,
  GAME_QUESTION_ANSWER_TIME,
  MEDIA_DOWNLOAD_TIMEOUT,
} from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ClientError } from "domain/errors/ClientError";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { AnswerResultLogic } from "domain/logic/question/AnswerResultLogic";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";
import { PlayerSkipLogic } from "domain/logic/question/PlayerSkipLogic";
import { QuestionAnswerRequestLogic } from "domain/logic/question/QuestionAnswerRequestLogic";
import { QuestionForceSkipLogic } from "domain/logic/question/QuestionForceSkipLogic";
import { QuestionPickLogic } from "domain/logic/question/QuestionPickLogic";
import { GamePauseLogic } from "domain/logic/timer/GamePauseLogic";
import { TimerPersistenceLogic } from "domain/logic/timer/TimerPersistenceLogic";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";
import { StakeBidSubmitInputData } from "domain/types/socket/events/game/StakeQuestionEventData";
import {
  AnswerResultData,
  AnswerResultType,
} from "domain/types/socket/game/AnswerResultData";
import { SecretQuestionTransferInputData } from "domain/types/socket/game/SecretQuestionTransferData";
import { StakeBidSubmitResult } from "domain/types/socket/question/StakeQuestionResults";
import { SpecialQuestionUtils } from "domain/utils/QuestionUtils";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";
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
    private readonly specialQuestionService: SpecialQuestionService,
    private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Handle player requesting to answer a question.
   */
  public async handleQuestionAnswer(socketId: string) {
    // Context & Validation
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    QuestionAnswerRequestLogic.validate(game, currentPlayer);

    // Save showing timer to have timer restore point
    await this.socketGameTimerService.saveElapsedTimer(
      game,
      GAME_QUESTION_ANSWER_SUBMIT_TIME,
      QuestionState.SHOWING
    );

    // Execution
    const timer = await this.socketQuestionStateService.setupAnsweringTimer(
      game,
      GAME_QUESTION_ANSWER_SUBMIT_TIME,
      currentPlayer!.meta.id
    );

    return QuestionAnswerRequestLogic.buildResult({
      game,
      playerId: currentPlayer?.meta.id,
      timer,
    });
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

  /**
   * Handle showman reviewing player's answer (correct/wrong).
   */
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

    // Process answer via Logic class
    const mutation = AnswerResultLogic.processAnswer(game, data);

    // Update player answer statistics for persistence
    try {
      await this.playerGameStatsService.updatePlayerAnswerStats(
        game.id,
        mutation.playerAnswerResult.player,
        data.answerType,
        mutation.playerAnswerResult.score
      );
    } catch (error) {
      // Log but don't throw - statistics shouldn't break game flow
      this.logger.warn("Failed to update player answer statistics", {
        prefix: "[SOCKET_QUESTION_SERVICE]: ",
        gameId: game.id,
        playerId: mutation.playerAnswerResult.player,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Handle timer based on next state
    let timer: GameStateTimerDTO | null = null;

    if (mutation.nextState === QuestionState.SHOWING) {
      if (mutation.allPlayersSkipped) {
        // All players exhausted - reset to choosing
        await this.socketQuestionStateService.resetToChoosingState(game);
      } else {
        // Continue question showing - restore saved timer
        timer = await this.gameService.getTimer(game.id, QuestionState.SHOWING);
        if (timer) {
          // Update resumedAt since timer is being restored from saved state
          GamePauseLogic.updateTimerForResume(timer);
        }
      }
    } else if (mutation.nextState === QuestionState.CHOOSING) {
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
        TimerPersistenceLogic.getSafeTtlMs(timer)
      );
    } else {
      // Always make sure all timers are cleared if not meant to be running
      await this.gameService.clearTimer(game.id);
    }

    return AnswerResultLogic.buildResult({ game, mutation, timer });
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

    QuestionActionValidator.validateForceSkipAction({
      game,
      currentPlayer,
      action: QuestionAction.SKIP,
    });

    // Get question to skip via Logic class
    const { question, themeId } =
      QuestionForceSkipLogic.getQuestionToSkip(game);

    // Process force skip via Logic class
    QuestionForceSkipLogic.processForceSkip(game, question, themeId);

    await this.socketQuestionStateService.resetToChoosingState(game);

    return QuestionForceSkipLogic.buildResult({ game, question });
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

    // Execution via Logic class
    PlayerSkipLogic.processUnskip(game, currentPlayer!);

    // Save
    await this.gameService.updateGame(game);

    return PlayerSkipLogic.buildUnskipResult({
      game,
      playerId: currentPlayer!.meta.id,
    });
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

    // Validate question via Logic class
    const questionData = QuestionPickLogic.validateQuestionPick(
      game,
      questionId
    );
    const { question, theme } = questionData;

    // Execution
    let timer: GameStateTimer | null = null;
    let specialQuestionData:
      | SecretQuestionGameData
      | StakeQuestionGameData
      | null = null;
    let automaticNominalBid: PlayerBidData | null = null;

    if (question.type === PackageQuestionType.SECRET) {
      specialQuestionData = this.specialQuestionService.setupSecretQuestion(
        game,
        question,
        currentPlayer!
      );
      // If no special question data (no active players), proceed as normal question
      if (!specialQuestionData) {
        QuestionPickLogic.handleSpecialQuestionFallback(
          game,
          PackageQuestionType.SECRET,
          questionData
        );
        timer = await this.socketQuestionStateService.setupQuestionTimer(
          game,
          GAME_QUESTION_ANSWER_TIME,
          QuestionState.SHOWING
        );
      }
    } else if (question.type === PackageQuestionType.STAKE) {
      const stakeSetupResult =
        await this.specialQuestionService.setupStakeQuestion(
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
        QuestionPickLogic.handleSpecialQuestionFallback(
          game,
          PackageQuestionType.STAKE,
          questionData
        );
        timer = await this.socketQuestionStateService.setupQuestionTimer(
          game,
          GAME_QUESTION_ANSWER_TIME,
          QuestionState.SHOWING
        );
      }
    } else {
      // Normal question flow - set up media download timer first
      // Players need to download media before showing the question
      timer = await this.socketQuestionStateService.setupQuestionTimer(
        game,
        MEDIA_DOWNLOAD_TIMEOUT,
        QuestionState.MEDIA_DOWNLOADING
      );
      // For normal questions, set currentQuestion immediately
      game.gameState.currentQuestion =
        GameQuestionMapper.mapToSimpleQuestion(question);
    }

    // Mark question as played for all types
    QuestionPickLogic.markQuestionPlayed(game, question.id!, theme.id!);

    // Reset media download status for all players
    QuestionPickLogic.resetMediaDownloadStatus(game);

    // Save
    await this.gameService.updateGame(game);

    return QuestionPickLogic.buildResult({
      game,
      question,
      timer,
      specialQuestionData,
      automaticNominalBid,
    });
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
    return this.specialQuestionService.handleSecretQuestionTransfer(
      socketId,
      data
    );
  }

  public async handleStakeBidSubmit(
    socketId: string,
    inputData: StakeBidSubmitInputData
  ): Promise<StakeBidSubmitResult> {
    return this.specialQuestionService.handleStakeBidSubmit(
      socketId,
      inputData
    );
  }

  /**
   * Handles give up scenario: applies penalty and transitions to SHOWING
   */
  private async _handleGiveUp(game: Game, currentPlayer: Player) {
    // Process give up via Logic class
    const mutation = PlayerSkipLogic.processGiveUp(game, currentPlayer);

    // Update statistics
    await this._updatePlayerStatsForGiveUp(game, mutation.playerAnswerResult);

    // Set up timer for SHOWING state
    const timer = await this._setupShowingTimer(game);

    // Save game state
    await this.gameService.updateGame(game);
    await this.gameService.saveTimer(timer, game.id);

    return PlayerSkipLogic.buildGiveUpResult({
      game,
      playerId: currentPlayer.meta.id,
      mutation,
      timer,
    });
  }

  /**
   * Handles regular skip: just marks player as skipped
   */
  private async _handleRegularSkip(game: Game, currentPlayer: Player) {
    PlayerSkipLogic.processRegularSkip(game, currentPlayer);
    await this.gameService.updateGame(game);

    return PlayerSkipLogic.buildRegularSkipResult({
      game,
      playerId: currentPlayer.meta.id,
    });
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

  /**
   * Handle media downloaded event from a player.
   */
  public async handleMediaDownloaded(socketId: string) {
    // Context & Validation
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    // Mark player as ready via Logic class
    MediaDownloadLogic.markPlayerReady(currentPlayer);

    // Check if all active players have downloaded media
    const allPlayersReady = MediaDownloadLogic.areAllPlayersReady(game);

    // If all players are ready, transition to SHOWING state
    if (
      allPlayersReady &&
      game.gameState.questionState === QuestionState.MEDIA_DOWNLOADING
    ) {
      // Clear the media download timeout timer
      await this.gameService.clearTimer(game.id);

      // Set up the actual question showing timer
      const timer = await this.socketQuestionStateService.setupQuestionTimer(
        game,
        GAME_QUESTION_ANSWER_TIME,
        QuestionState.SHOWING
      );

      await this.gameService.updateGame(game);

      return MediaDownloadLogic.buildResult({
        game,
        playerId: currentPlayer.meta.id,
        allPlayersReady,
        timer: timer.value(),
      });
    }

    // Save game state
    await this.gameService.updateGame(game);

    // If all players are ready, include the timer
    const timer = allPlayersReady && game.timer ? game.timer : null;

    return MediaDownloadLogic.buildResult({
      game,
      playerId: currentPlayer.meta.id,
      allPlayersReady,
      timer,
    });
  }

  /**
   * Reset media download status for all players
   */
  public resetMediaDownloadStatus(game: Game): void {
    MediaDownloadLogic.resetAllPlayerStatus(game);
  }

  /**
   * Force all players to be marked as ready (used by timeout).
   */
  public async forceAllPlayersReady(gameId: string) {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game) return null;

    // Force all players ready via Logic class
    MediaDownloadLogic.forceAllPlayersReady(game);

    // Clear the media download timeout timer
    await this.gameService.clearTimer(game.id);

    // Set up the question showing timer
    const timer = await this.socketQuestionStateService.setupQuestionTimer(
      game,
      GAME_QUESTION_ANSWER_TIME,
      QuestionState.SHOWING
    );

    await this.gameService.updateGame(game);

    return {
      game,
      timer: timer.value(),
    };
  }
}

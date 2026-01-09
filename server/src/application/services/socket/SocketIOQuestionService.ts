import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import {
  GAME_QUESTION_ANSWER_SUBMIT_TIME,
  GAME_QUESTION_ANSWER_TIME,
} from "domain/constants/game";
import { ActionContext } from "domain/types/action/ActionContext";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { AnswerSubmittedLogic } from "domain/logic/question/AnswerSubmittedLogic";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";
import { PlayerSkipLogic } from "domain/logic/question/PlayerSkipLogic";
import { QuestionAnswerRequestLogic } from "domain/logic/question/QuestionAnswerRequestLogic";
import { QuestionForceSkipLogic } from "domain/logic/question/QuestionForceSkipLogic";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { SpecialRegularQuestionUtils } from "domain/utils/QuestionUtils";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

/**
 * Service handling question-related socket events.
 *
 * TODO: Would be better to split on multiple services per question action (answer, answerResult, etc).
 */
@singleton()
export class SocketIOQuestionService {
  constructor(
    private readonly gameService: GameService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly socketGameValidationService: SocketGameValidationService,
    private readonly socketQuestionStateService: SocketQuestionStateService,
    private readonly socketGameTimerService: SocketGameTimerService,
    private readonly roundHandlerFactory: RoundHandlerFactory,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Handle player requesting to answer a question.
   */
  public async handleQuestionAnswer(ctx: ActionContext) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    QuestionAnswerRequestLogic.validate(game, currentPlayer);

    // Save showing timer to have timer restore point
    await this.socketGameTimerService.saveElapsedTimer(
      game,
      GAME_QUESTION_ANSWER_SUBMIT_TIME,
      QuestionState.SHOWING
    );

    // Transition to media downloading phase
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { playerId: currentPlayer!.meta.id, isSystem: false },
    });

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    await this.gameService.updateGame(game);

    const timerDto = transitionResult.timer;
    const timer = timerDto ? GameStateTimer.fromDTO(timerDto) : null;

    if (!timer) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    return QuestionAnswerRequestLogic.buildResult({
      game,
      playerId: currentPlayer?.meta.id,
      timer,
    });
  }

  /**
   * Handle player submitting their answer text.
   * TODO: Additional answer processing not implemented yet.
   */
  public async handleAnswerSubmitted(
    ctx: ActionContext,
    data: { answerText: string | null }
  ) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    AnswerSubmittedLogic.validate(game, currentPlayer);

    return AnswerSubmittedLogic.buildResult({
      game,
      answerText: data.answerText,
    });
  }

  /**
   * Skip the show-answer phase.
   * Returns result with broadcasts for ANSWER_SHOW_END and optional round progression.
   */
  public async skipShowAnswer(ctx: ActionContext) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    // Validate: only showman can skip
    if (currentPlayer?.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_SKIP_SHOW_ANSWER);
    }

    // Validate: must be in SHOWING_ANSWER state
    if (game.gameState.questionState !== QuestionState.SHOWING_ANSWER) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { playerId: currentPlayer.meta.id, isSystem: false },
    });

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    await this.gameService.updateGame(game);

    return {
      data: {},
      broadcasts: transitionResult.broadcasts,
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

  public async handleQuestionForceSkip(ctx: ActionContext) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    QuestionActionValidator.validateForceSkipAction({
      game,
      currentPlayer,
      action: QuestionAction.FORCE_SKIP,
    });

    // Get question to skip via Logic class
    const { question, themeId } =
      QuestionForceSkipLogic.getQuestionToSkip(game);

    // Process force skip via Logic class
    QuestionForceSkipLogic.processForceSkip(game, question, themeId);

    await this.socketQuestionStateService.resetToChoosingState(game);

    return QuestionForceSkipLogic.buildResult({ game, question });
  }

  public async handlePlayerSkip(ctx: ActionContext) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    QuestionActionValidator.validatePlayerSkipAction({
      game,
      currentPlayer,
      action: QuestionAction.PLAYER_SKIP,
    });

    // Check if this skip should be treated as a "give up" with penalty
    if (SpecialRegularQuestionUtils.isGiveUpScenario(game)) {
      return await this._handleGiveUp(game, currentPlayer!);
    }

    // Default skip behavior: just mark player as skipped
    return await this._handleRegularSkip(game, currentPlayer!);
  }

  public async handlePlayerUnskip(ctx: ActionContext) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

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
      prefix: LogPrefix.SOCKET,
      operationsCount: socketsIds.length,
    });

    // TODO: Find a way to optimize this to reduce redis calls
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
      prefix: LogPrefix.SOCKET,
      operationsCount: socketsIds.length,
    });

    // TODO: Find a way to optimize this to reduce redis calls
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
        prefix: LogPrefix.SOCKET_QUESTION,
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
  public async handleMediaDownloaded(ctx: ActionContext) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    if (!currentPlayer) {
      throw new ClientError(ClientResponse.PLAYER_NOT_FOUND);
    }

    // Mark player as ready via Logic class
    MediaDownloadLogic.markPlayerReady(currentPlayer);

    const allPlayersReady = MediaDownloadLogic.areAllPlayersReady(game);

    // Set it to null while not all ready
    let transitionTimer = null;

    if (
      allPlayersReady &&
      game.gameState.questionState === QuestionState.MEDIA_DOWNLOADING
    ) {
      const transitionResult = await this.phaseTransitionRouter.tryTransition({
        game,
        trigger: TransitionTrigger.USER_ACTION,
        triggeredBy: { playerId: currentPlayer.meta.id, isSystem: false },
      });

      if (transitionResult) {
        // Set timer for question showing when all ready and state transitioned
        transitionTimer = transitionResult.timer ?? null;
      }
    }

    await this.gameService.updateGame(game);

    return MediaDownloadLogic.buildResult({
      game,
      playerId: currentPlayer.meta.id,
      allPlayersReady,
      timer: transitionTimer,
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

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.TIMER_EXPIRED,
      triggeredBy: { isSystem: true },
    });

    await this.gameService.updateGame(game);

    return {
      game,
      timer: transitionResult?.timer ?? null,
    };
  }
}

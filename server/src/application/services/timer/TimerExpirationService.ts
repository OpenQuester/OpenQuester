import { GameService } from "application/services/game/GameService";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { GAME_TTL_IN_SECONDS, SYSTEM_PLAYER_ID } from "domain/constants/game";
import { MIN_TIMER_TTL_MS } from "domain/constants/timer";
import { Game } from "domain/entities/game/Game";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { FinalAnswerLossReason } from "domain/enums/FinalRoundTypes";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import {
  BroadcastEvent,
  TimerExpirationResult,
} from "domain/types/service/ServiceResult";
import {
  FinalAnswerSubmitOutputData,
  FinalAutoLossEventData,
  FinalPhaseCompleteEventData,
  FinalQuestionEventData,
  FinalSubmitEndEventData,
  ThemeEliminateOutputData,
} from "domain/types/socket/events/FinalRoundEventData";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { ILogger } from "infrastructure/logger/ILogger";

/**
 * Service handling timer expiration logic
 * Extracts business logic from TimerExpirationHandler
 */
export class TimerExpirationService {
  constructor(
    private readonly gameService: GameService,
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly socketQuestionStateService: SocketQuestionStateService,
    private readonly roundHandlerFactory: RoundHandlerFactory,
    private readonly finalRoundService: FinalRoundService,
    private readonly gameStatisticsCollectorService: GameStatisticsCollectorService,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Handle media download timeout - forces all players ready.
   */
  public async handleMediaDownloadExpiration(
    gameId: string
  ): Promise<TimerExpirationResult> {
    const result = await this.socketIOQuestionService.forceAllPlayersReady(
      gameId
    );

    if (!result) {
      return {
        success: false,
        broadcasts: [],
        shouldContinue: false,
      };
    }

    return {
      success: true,
      game: result.game,
      broadcasts: [
        {
          event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          data: {
            playerId: SYSTEM_PLAYER_ID,
            mediaDownloaded: true,
            allPlayersReady: true,
            timer: result.timer,
          } satisfies MediaDownloadStatusBroadcastData,
          room: gameId,
        },
      ],
      shouldContinue: false,
    };
  }

  /**
   * Handle question showing timeout - resets to choosing state.
   */
  public async handleQuestionShowingExpiration(
    gameId: string
  ): Promise<TimerExpirationResult> {
    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );
    const question = await this.socketIOQuestionService.getCurrentQuestion(
      game
    );

    await this.socketQuestionStateService.resetToChoosingState(game);

    const broadcasts: BroadcastEvent[] = [
      {
        event: SocketIOGameEvents.QUESTION_FINISH,
        data: {
          answerFiles: question.answerFiles ?? null,
          answerText: question.answerText ?? null,
          nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
        } satisfies QuestionFinishEventPayload,
        room: gameId,
      },
    ];

    if (!game.isAllQuestionsPlayed()) {
      return {
        success: true,
        game,
        broadcasts,
        shouldContinue: false,
      };
    }

    // Handle round progression
    const progressionBroadcasts = await this.handleRoundProgression(
      game,
      gameId
    );
    broadcasts.push(...progressionBroadcasts);

    return {
      success: true,
      game,
      broadcasts,
      shouldContinue: false,
    };
  }

  /**
   * Handle answering timeout - routes to final round or regular handling.
   */
  public async handleAnsweringExpiration(
    gameId: string
  ): Promise<TimerExpirationResult> {
    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );
    // Check if final round answering
    if (
      TransitionGuards.isFinalRound(game) &&
      TransitionGuards.isQuestionState(game, QuestionState.ANSWERING)
    ) {
      return this.handleFinalRoundAnsweringExpiration(game);
    }

    const question = await this.socketIOQuestionService.getCurrentQuestion(
      game
    );

    // Regular answering expiration
    const { answerResult, timer } = await this.handleRegularAnsweringExpiration(
      game,
      question
    );

    return {
      success: true,
      game,
      broadcasts: [
        {
          event: SocketIOGameEvents.ANSWER_RESULT,
          data: {
            answerResult,
            timer,
          } satisfies QuestionAnswerResultEventPayload,
          room: gameId,
        },
      ],
      shouldContinue: false,
    };
  }

  /**
   * Handle theme elimination timeout - auto-eliminates theme.
   */
  public async handleThemeEliminationExpiration(
    gameId: string
  ): Promise<TimerExpirationResult> {
    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );
    const result = await this.finalRoundService.handleThemeEliminationTimeout(
      gameId
    );

    const broadcasts: BroadcastEvent[] = [
      {
        event: SocketIOGameEvents.THEME_ELIMINATE,
        data: {
          themeId: result.themeId,
          eliminatedBy: SYSTEM_PLAYER_ID,
          nextPlayerId: result.nextPlayerId,
        } satisfies ThemeEliminateOutputData,
        room: gameId,
      },
    ];

    if (result.isPhaseComplete) {
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
        data: {
          phase: FinalRoundPhase.THEME_ELIMINATION,
          nextPhase: FinalRoundPhase.BIDDING,
        } satisfies FinalPhaseCompleteEventData,
        room: gameId,
      });
    }

    return {
      success: true,
      game,
      broadcasts,
      shouldContinue: false,
    };
  }

  /**
   * Handle bidding timeout - auto-bids for remaining players.
   */
  public async handleBiddingExpiration(
    gameId: string
  ): Promise<TimerExpirationResult> {
    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );
    const result = await this.finalRoundService.handleBiddingTimeout(gameId);

    const broadcasts: BroadcastEvent[] = [
      {
        event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
        data: {
          phase: FinalRoundPhase.BIDDING,
          nextPhase: FinalRoundPhase.ANSWERING,
        } satisfies FinalPhaseCompleteEventData,
        room: gameId,
      },
      {
        event: SocketIOGameEvents.FINAL_QUESTION_DATA,
        data: {
          questionData: result.questionData,
        } satisfies FinalQuestionEventData,
        room: gameId,
      },
    ];

    return {
      success: true,
      game,
      broadcasts,
      shouldContinue: false,
    };
  }

  private async handleRoundProgression(
    game: Game,
    gameId: string
  ): Promise<BroadcastEvent[]> {
    const roundHandler = this.roundHandlerFactory.createFromGame(game);
    const { isGameFinished, nextGameState } =
      await roundHandler.handleRoundProgression(game, { forced: false });

    const broadcasts: BroadcastEvent[] = [];

    if (isGameFinished || nextGameState) {
      await this.gameService.updateGame(game);
    }

    if (isGameFinished) {
      try {
        await this.gameStatisticsCollectorService.finishCollection(gameId);
      } catch (error) {
        this.logger.warn("Failed to execute statistics persistence", {
          gameId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      broadcasts.push({
        event: SocketIOGameEvents.GAME_FINISHED,
        data: true,
        room: gameId,
      });
      return broadcasts;
    }

    if (nextGameState) {
      broadcasts.push({
        event: SocketIOGameEvents.NEXT_ROUND,
        data: { gameState: nextGameState } satisfies GameNextRoundEventPayload,
        room: gameId,
      });
    }

    return broadcasts;
  }

  private async handleRegularAnsweringExpiration(
    game: Game,
    question: PackageQuestionDTO
  ) {
    const nextState = QuestionState.SHOWING;
    const scoreResult = question.price !== null ? -question.price : 0;

    const playerAnswerResult = game.handleQuestionAnswer(
      scoreResult,
      AnswerResultType.WRONG,
      nextState
    );

    try {
      await this.playerGameStatsService.updatePlayerAnswerStats(
        game.id,
        playerAnswerResult.player,
        AnswerResultType.WRONG,
        playerAnswerResult.score
      );
    } catch (error) {
      this.logger.warn("Failed to update player answer statistics on timeout", {
        prefix: "[TIMER_EXPIRATION_SERVICE]: ",
        gameId: game.id,
        playerId: playerAnswerResult.player,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const timer = await this.gameService.getTimer(
      game.id,
      QuestionState.SHOWING
    );

    game.setTimer(timer);
    await this.gameService.updateGame(game);

    if (timer) {
      const remainingTimeMs = timer.durationMs - timer.elapsedMs;
      const ttlMs = Math.max(remainingTimeMs, MIN_TIMER_TTL_MS);
      await this.gameService.saveTimer(timer, game.id, ttlMs);
    }

    return { answerResult: playerAnswerResult, timer };
  }

  /**
   * Handle final round answering timeout - creates auto-loss entries.
   */
  private async handleFinalRoundAnsweringExpiration(
    game: Game
  ): Promise<TimerExpirationResult> {
    const result = await this.finalRoundService.processAutoLossAnswers(game.id);

    const broadcasts: BroadcastEvent[] = [];

    // Emit auto-loss events
    for (const autoLossReview of result.autoLossReviews) {
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        data: {
          playerId: autoLossReview.playerId,
        } satisfies FinalAnswerSubmitOutputData,
        room: game.id,
      });

      // Also emit auto-loss event for timeout
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_AUTO_LOSS,
        data: {
          playerId: autoLossReview.playerId,
          reason: FinalAnswerLossReason.TIMEOUT,
        } satisfies FinalAutoLossEventData,
        room: game.id,
      });
    }

    // If ready for review, emit phase completion
    if (result.isReadyForReview && result.allReviews) {
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_SUBMIT_END,
        data: {
          phase: FinalRoundPhase.ANSWERING,
          nextPhase: FinalRoundPhase.REVIEWING,
          allReviews: result.allReviews,
        } satisfies FinalSubmitEndEventData,
        room: game.id,
      });
    }

    return {
      success: true,
      game,
      broadcasts,
      shouldContinue: false,
    };
  }
}

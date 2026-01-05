import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { GameService } from "application/services/game/GameService";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { GAME_TTL_IN_SECONDS, SYSTEM_PLAYER_ID } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { FinalAnswerLossReason } from "domain/enums/FinalRoundTypes";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { ShowAnswerLogic } from "domain/logic/question/ShowAnswerLogic";
import { AnsweringExpirationLogic } from "domain/logic/timer/AnsweringExpirationLogic";
import { GamePauseLogic } from "domain/logic/timer/GamePauseLogic";
import { TimerPersistenceLogic } from "domain/logic/timer/TimerPersistenceLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import {
  BroadcastEvent,
  TimerExpirationResult,
} from "domain/types/service/ServiceResult";
import {
  FinalAnswerSubmitOutputData,
  SocketIOFinalAutoLossEventPayload,
  ThemeEliminateOutputData,
} from "domain/types/socket/events/FinalRoundEventData";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { MediaDownloadStatusBroadcastData } from "domain/types/socket/events/game/MediaDownloadStatusEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";

/**
 * Service handling timer expiration logic.
 * Extracts business logic from TimerExpirationHandler.
 */
@singleton()
export class TimerExpirationService {
  constructor(
    private readonly gameService: GameService,
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly socketQuestionStateService: SocketQuestionStateService,
    private readonly roundHandlerFactory: RoundHandlerFactory,
    private readonly finalRoundService: FinalRoundService,
    private readonly gameStatisticsCollectorService: GameStatisticsCollectorService,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    @inject(DI_TOKENS.Logger)
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
    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );
    if (!game) {
      return { success: false, broadcasts: [] };
    }
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.TIMER_EXPIRED,
      triggeredBy: { isSystem: true },
    });
    if (!transitionResult) {
      return { success: false, broadcasts: [] };
    }
    const timer = transitionResult.timer ?? null;
    return {
      success: true,
      game,
      broadcasts: [
        {
          event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          data: {
            playerId: SYSTEM_PLAYER_ID,
            mediaDownloaded: true,
            allPlayersReady: true,
            timer,
          } satisfies MediaDownloadStatusBroadcastData,
          room: gameId,
        },
      ],
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
    if (!game) {
      return { success: false, broadcasts: [] };
    }
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.TIMER_EXPIRED,
      triggeredBy: { isSystem: true },
    });
    if (!transitionResult) {
      return { success: false, broadcasts: [] };
    }
    return {
      success: true,
      game,
      broadcasts: transitionResult.broadcasts,
    };
  }

  /**
   * Handle show answer timeout - transitions from SHOWING_ANSWER to CHOOSING.
   * Called when the answer display timer expires after a correct answer or all players exhausted.
   */
  public async handleShowAnswerExpiration(
    gameId: string
  ): Promise<TimerExpirationResult> {
    const game = await this.gameService.getGameEntity(
      gameId,
      GAME_TTL_IN_SECONDS
    );

    // Reset to choosing state
    await this.socketQuestionStateService.resetToChoosingState(game);

    const broadcasts: BroadcastEvent[] = [
      ShowAnswerLogic.buildAnswerShowEndBroadcast(gameId),
    ];

    // Check if round progression is needed
    if (!ShowAnswerLogic.shouldProgressRound(game)) {
      return {
        success: true,
        game,
        broadcasts,
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

    // Check if final round answering via Logic class
    if (AnsweringExpirationLogic.isFinalRoundExpiration(game)) {
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
        AnsweringExpirationLogic.buildBroadcast(gameId, answerResult, timer),
      ],
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

    if (result.transitionResult) {
      broadcasts.push(...result.transitionResult.broadcasts);
    }

    return {
      success: true,
      game,
      broadcasts,
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
      ...result.transitionResult.broadcasts,
    ];

    return {
      success: true,
      game,
      broadcasts,
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
          prefix: LogPrefix.TIMER_EXPIRATION,
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
    // Process wrong answer via Logic class
    const mutation = AnsweringExpirationLogic.processWrongAnswer(
      game,
      question
    );

    try {
      await this.playerGameStatsService.updatePlayerAnswerStats(
        game.id,
        mutation.answerResult.player,
        AnswerResultType.WRONG,
        mutation.answerResult.score
      );
    } catch (error) {
      this.logger.warn("Failed to update player answer statistics on timeout", {
        prefix: LogPrefix.TIMER_EXPIRATION,
        gameId: game.id,
        playerId: mutation.answerResult.player,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const timer = await this.gameService.getTimer(
      game.id,
      QuestionState.SHOWING
    );

    if (timer) {
      // Update resumedAt since timer is being restored from saved state
      GamePauseLogic.updateTimerForResume(timer);
    }

    game.setTimer(timer);
    await this.gameService.updateGame(game);

    if (timer) {
      await this.gameService.saveTimer(
        timer,
        game.id,
        TimerPersistenceLogic.getSafeTtlMs(timer)
      );
    }

    return { answerResult: mutation.answerResult, timer };
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
        } satisfies SocketIOFinalAutoLossEventPayload,
        room: game.id,
      });
    }

    if (result.transitionResult) {
      broadcasts.push(...result.transitionResult.broadcasts);
    }

    return {
      success: true,
      game,
      broadcasts,
    };
  }
}

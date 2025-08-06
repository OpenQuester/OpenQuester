import { Server as IOServer, Namespace } from "socket.io";

import { GameService } from "application/services/game/GameService";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { REDIS_LOCK_EXPIRATION_KEY } from "domain/constants/redis";
import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { TIMER_NSP } from "domain/constants/timer";
import { Game } from "domain/entities/game/Game";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { ErrorController } from "domain/errors/ErrorController";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { RedisExpirationHandler } from "domain/types/redis/RedisExpirationHandler";
import {
  FinalAnswerSubmitOutputData,
  FinalPhaseCompleteEventData,
  FinalQuestionEventData,
  FinalSubmitEndEventData,
  ThemeEliminateOutputData,
} from "domain/types/socket/events/FinalRoundEventData";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { ILogger } from "infrastructure/logger/ILogger";
import { RedisService } from "infrastructure/services/redis/RedisService";

export class TimerExpirationHandler implements RedisExpirationHandler {
  private _gameNsp?: Namespace;

  constructor(
    private readonly io: IOServer,
    private readonly gameService: GameService,
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly redisService: RedisService,
    private readonly socketQuestionStateService: SocketQuestionStateService,
    private readonly roundHandlerFactory: RoundHandlerFactory,
    private readonly finalRoundService: FinalRoundService,
    private readonly gameStatisticsCollectorService: GameStatisticsCollectorService,
    private readonly logger: ILogger
  ) {
    //
  }

  public supports(key: string): boolean {
    return key.startsWith(`${TIMER_NSP}:`);
  }

  public async handle(key: string): Promise<void> {
    const lockKey = `${REDIS_LOCK_EXPIRATION_KEY}:${key}`;
    const acquired = await this.redisService.setLockKey(lockKey);

    if (!acquired) {
      this.logger.debug(
        `Lock not acquired for key ${key}, another instance is handling it`
      );
      return; // Another instance acquired the lock
    }

    const gameId = key.split(":")[1];

    try {
      const game = await this.gameService.getGameEntity(
        gameId,
        GAME_TTL_IN_SECONDS
      );
      const question = await this.socketIOQuestionService.getCurrentQuestion(
        game
      );

      if (game.gameState.questionState === QuestionState.SHOWING) {
        await this.socketQuestionStateService.resetToChoosingState(game);

        this._gameNamespace
          .to(gameId)
          .emit(SocketIOGameEvents.QUESTION_FINISH, {
            answerFiles: question.answerFiles ?? null,
            answerText: question.answerText ?? null,
            nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
          } satisfies QuestionFinishEventPayload);

        if (!game.isAllQuestionsPlayed()) {
          return;
        }

        // Next round if all questions played
        const roundHandler = this.roundHandlerFactory.createFromGame(game);
        const { isGameFinished, nextGameState } =
          await roundHandler.handleRoundProgression(game, { forced: false });

        if (isGameFinished || nextGameState) {
          await this.gameService.updateGame(game);
        }

        if (isGameFinished) {
          // Finish statistics collection and trigger persistence
          try {
            await this.gameStatisticsCollectorService.finishCollection(gameId);
          } catch (error) {
            this.logger.warn("Failed to execute statistics persistence", {
              gameId,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          this._gameNamespace
            .to(gameId)
            .emit(SocketIOGameEvents.GAME_FINISHED, true);
          return;
        }

        if (nextGameState) {
          this._gameNamespace.to(gameId).emit(SocketIOGameEvents.NEXT_ROUND, {
            gameState: nextGameState,
          } satisfies GameNextRoundEventPayload);
          return;
        }
      }

      // Handle final round specific timeouts
      if (game.gameState.questionState === QuestionState.THEME_ELIMINATION) {
        await this._handleThemeEliminationTimeout(game);
        return;
      }

      if (game.gameState.questionState === QuestionState.BIDDING) {
        await this._handleBiddingTimeout(game);
        return;
      }

      if (game.gameState.questionState === QuestionState.ANSWERING) {
        // Check if this is a final round answer submission timeout
        if (this._isFinalRoundAnswering(game)) {
          await this._handleFinalRoundAnsweringExpiration(game);
          return;
        }

        const { answerResult, timer } = await this._handleAnsweringExpiration(
          game,
          question
        );

        this._gameNamespace.to(gameId).emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerResult,
          timer,
        } satisfies QuestionAnswerResultEventPayload);
        return;
      }
    } catch (err: unknown) {
      const error = await ErrorController.resolveError(err, this.logger);
      this._gameNamespace.to(gameId).emit(SocketIOEvents.ERROR, {
        message: error.message,
      });
    }
  }

  private async _handleAnsweringExpiration(
    game: Game,
    question: PackageQuestionDTO
  ) {
    // On time expiration we always accept answer as wrong with x1 score value
    const nextState = QuestionState.SHOWING;

    // For final round questions with null price, use 0 as score result
    // since players bid after theme selection and timeout handling differs
    const scoreResult = question.price !== null ? -question.price : 0;

    const playerAnswerResult = game.handleQuestionAnswer(
      scoreResult,
      AnswerResultType.WRONG,
      nextState
    );

    const timer = await this.gameService.getTimer(
      game.id,
      QuestionState.SHOWING
    );

    game.setTimer(timer);
    await this.gameService.updateGame(game);
    if (timer) {
      await this.gameService.saveTimer(
        timer,
        game.id,
        timer.durationMs - timer.elapsedMs
      );
    }

    return { answerResult: playerAnswerResult, timer };
  }

  /**
   * Check if the game is in final round answer submission phase
   */
  private _isFinalRoundAnswering(game: Game): boolean {
    return (
      game.gameState.currentRound?.type === PackageRoundType.FINAL &&
      game.gameState.questionState === QuestionState.ANSWERING
    );
  }

  /**
   * Handle final round answer submission timeout (75 seconds expired)
   * This processes auto-loss answers and transitions to reviewing phase
   */
  private async _handleFinalRoundAnsweringExpiration(
    game: Game
  ): Promise<void> {
    const result = await this.finalRoundService.processAutoLossAnswers(game.id);

    // Emit auto-loss events for players who didn't submit in time
    for (const autoLossReview of result.autoLossReviews) {
      this._gameNamespace
        .to(game.id)
        .emit(SocketIOGameEvents.FINAL_ANSWER_SUBMIT, {
          playerId: autoLossReview.playerId,
        } satisfies FinalAnswerSubmitOutputData);
    }

    // If ready for review phase, emit phase completion event with all reviews
    if (result.isReadyForReview && result.allReviews) {
      this._gameNamespace
        .to(game.id)
        .emit(SocketIOGameEvents.FINAL_SUBMIT_END, {
          phase: FinalRoundPhase.ANSWERING,
          nextPhase: FinalRoundPhase.REVIEWING,
          allReviews: result.allReviews,
        } satisfies FinalSubmitEndEventData);
    }
  }

  /**
   * Handle theme elimination timeout by calling FinalRoundService
   */
  private async _handleThemeEliminationTimeout(game: Game): Promise<void> {
    try {
      const result = await this.finalRoundService.handleThemeEliminationTimeout(
        game.id
      );

      // Emit theme elimination event
      this._gameNamespace.to(game.id).emit(SocketIOGameEvents.THEME_ELIMINATE, {
        themeId: result.themeId,
        eliminatedBy: null, // System elimination
        nextPlayerId: result.nextPlayerId,
      } satisfies ThemeEliminateOutputData);

      // If phase is complete, emit phase completion event
      if (result.isPhaseComplete) {
        this._gameNamespace
          .to(game.id)
          .emit(SocketIOGameEvents.FINAL_PHASE_COMPLETE, {
            phase: FinalRoundPhase.THEME_ELIMINATION,
            nextPhase: FinalRoundPhase.BIDDING,
          } satisfies FinalPhaseCompleteEventData);
      }
    } catch (err: unknown) {
      const error = await ErrorController.resolveError(err, this.logger);
      this._gameNamespace.to(game.id).emit(SocketIOEvents.ERROR, {
        message: error.message,
      });
    }
  }

  /**
   * Handle bidding timeout by calling FinalRoundService
   */
  private async _handleBiddingTimeout(game: Game): Promise<void> {
    try {
      const result = await this.finalRoundService.handleBiddingTimeout(game.id);

      // Emit phase completion event
      this._gameNamespace
        .to(game.id)
        .emit(SocketIOGameEvents.FINAL_PHASE_COMPLETE, {
          phase: FinalRoundPhase.BIDDING,
          nextPhase: FinalRoundPhase.ANSWERING,
        } satisfies FinalPhaseCompleteEventData);

      // Emit question data for the final round
      this._gameNamespace
        .to(game.id)
        .emit(SocketIOGameEvents.FINAL_QUESTION_DATA, {
          questionData: result.questionData,
        } satisfies FinalQuestionEventData);
    } catch (err: unknown) {
      const error = await ErrorController.resolveError(err, this.logger);
      this._gameNamespace.to(game.id).emit(SocketIOEvents.ERROR, {
        message: error.message,
      });
    }
  }

  private get _gameNamespace() {
    if (!this._gameNsp) {
      this._gameNsp = this.io.of(SOCKET_GAME_NAMESPACE);
    }

    return this._gameNsp;
  }
}

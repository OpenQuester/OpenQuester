import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventBroadcast,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  FinalAnswerReviewInputData,
  FinalAnswerReviewOutputData,
} from "domain/types/socket/events/FinalAnswerReviewData";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

/**
 * Handler for showman to review and score final round answers
 * This follows the same pattern as regular AnswerResultEventHandler
 * but specifically for final round with bid-based scoring
 */
export class FinalAnswerReviewEventHandler extends BaseSocketEventHandler<
  FinalAnswerReviewInputData,
  FinalAnswerReviewOutputData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly finalRoundService: FinalRoundService,
    private readonly gameStatisticsCollectorService: GameStatisticsCollectorService,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.FINAL_ANSWER_REVIEW;
  }

  protected async getGameIdForAction(
    _data: FinalAnswerReviewInputData,
    context: SocketEventContext
  ): Promise<string | null> {
    try {
      const gameContext = await this.socketGameContextService.fetchGameContext(
        context.socketId
      );
      return gameContext.game?.id ?? null;
    } catch {
      return null;
    }
  }

  protected async validateInput(
    data: FinalAnswerReviewInputData
  ): Promise<FinalAnswerReviewInputData> {
    return GameValidator.validateFinalAnswerReview(data);
  }

  protected async authorize(
    _data: FinalAnswerReviewInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled in service - only showman can review answers
  }

  protected async execute(
    data: FinalAnswerReviewInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<FinalAnswerReviewOutputData>> {
    const { game, isGameFinished, reviewResult, questionAnswerData } =
      await this.finalRoundService.handleFinalAnswerReview(
        context.socketId,
        data
      );

    // Assign context variables for logging
    context.gameId = game.id;
    context.userId = context.userId;

    const outputData: FinalAnswerReviewOutputData = {
      answerId: data.answerId,
      playerId: reviewResult.playerId,
      isCorrect: data.isCorrect,
      scoreChange: reviewResult.scoreChange,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.FINAL_ANSWER_REVIEW,
        data: outputData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<FinalAnswerReviewOutputData>,
    ];

    // When all reviews are complete and game finishes
    if (isGameFinished) {
      broadcasts.push({
        event: SocketIOGameEvents.QUESTION_FINISH,
        data: {
          answerFiles: null,
          answerText: questionAnswerData?.answerText ?? null,
          nextTurnPlayerId: null, // No next turn when game finished
        },
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<QuestionFinishEventPayload>);

      broadcasts.push({
        event: SocketIOGameEvents.GAME_FINISHED,
        data: true,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<boolean>);

      // Trigger statistics persistence
      try {
        await this.gameStatisticsCollectorService.finishCollection(game.id);
      } catch (error) {
        this.logger.warn("Failed to execute statistics persistence", {
          gameId: game.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      success: true,
      data: outputData,
      broadcast: broadcasts,
    };
  }
}

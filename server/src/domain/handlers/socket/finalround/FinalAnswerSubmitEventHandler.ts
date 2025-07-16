import { Socket } from "socket.io";

import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { FinalAnswerLossReason } from "domain/enums/FinalRoundTypes";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventBroadcast,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  FinalAnswerSubmitInputData,
  FinalAnswerSubmitOutputData,
  FinalAutoLossEventData,
  FinalSubmitEndEventData,
} from "domain/types/socket/events/FinalRoundEventData";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class FinalAnswerSubmitEventHandler extends BaseSocketEventHandler<
  FinalAnswerSubmitInputData,
  FinalAnswerSubmitOutputData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    private readonly finalRoundService: FinalRoundService
  ) {
    super(socket, eventEmitter, logger);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.FINAL_ANSWER_SUBMIT;
  }

  protected async validateInput(
    data: FinalAnswerSubmitInputData
  ): Promise<FinalAnswerSubmitInputData> {
    return GameValidator.validateFinalAnswerSubmit(data);
  }

  protected async authorize(
    _data: FinalAnswerSubmitInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer
    // Only players can submit final answers
  }

  protected async execute(
    data: FinalAnswerSubmitInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<FinalAnswerSubmitOutputData>> {
    const { game, playerId, isPhaseComplete, isAutoLoss, allReviews } =
      await this.finalRoundService.handleFinalAnswerSubmit(
        this.socket.id,
        data.answerText
      );

    // Assign context variables for logging
    context.gameId = game.id;
    context.userId = this.socket.userId;

    const outputData: FinalAnswerSubmitOutputData = {
      playerId,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        data: outputData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<FinalAnswerSubmitOutputData>,
    ];

    // If this is an auto-loss (empty answer), send auto-loss event
    if (isAutoLoss) {
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_AUTO_LOSS,
        data: {
          playerId,
          reason: FinalAnswerLossReason.EMPTY_ANSWER,
        } satisfies FinalAutoLossEventData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      });
    }

    // If phase complete (all answers submitted), send submit-end event with all reviews
    if (isPhaseComplete) {
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_SUBMIT_END,
        data: {
          phase: FinalRoundPhase.ANSWERING,
          nextPhase: FinalRoundPhase.REVIEWING,
          allReviews,
        } satisfies FinalSubmitEndEventData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      });
    }

    return {
      success: true,
      data: outputData,
      broadcast: broadcasts,
    };
  }
}

import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventBroadcast,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  FinalBidSubmitInputData,
  FinalBidSubmitOutputData,
  FinalPhaseCompleteEventData,
  FinalQuestionEventData,
} from "domain/types/socket/events/FinalRoundEventData";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class FinalBidSubmitEventHandler extends BaseSocketEventHandler<
  FinalBidSubmitInputData,
  FinalBidSubmitOutputData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly finalRoundService: FinalRoundService,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.FINAL_BID_SUBMIT;
  }

  protected async getGameIdForAction(
    _data: FinalBidSubmitInputData,
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
    data: FinalBidSubmitInputData
  ): Promise<FinalBidSubmitInputData> {
    return GameValidator.validateBid(data);
  }

  protected async authorize(
    _data: FinalBidSubmitInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer
    // Only players can submit bids
  }

  protected async execute(
    data: FinalBidSubmitInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<FinalBidSubmitOutputData>> {
    const { game, playerId, bidAmount, isPhaseComplete, questionData, timer } =
      await this.finalRoundService.handleFinalBidSubmit(
        context.socketId,
        data.bid
      );

    // Assign context variables for logging
    context.gameId = game.id;
    context.userId = context.userId;

    const outputData: FinalBidSubmitOutputData = {
      playerId,
      bidAmount,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.FINAL_BID_SUBMIT,
        data: outputData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<FinalBidSubmitOutputData>,
    ];

    // If phase complete (all bids submitted), send question data and timer
    if (isPhaseComplete && questionData) {
      broadcasts.push({
        event: SocketIOGameEvents.FINAL_QUESTION_DATA,
        data: {
          questionData,
        } satisfies FinalQuestionEventData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<FinalQuestionEventData>);

      broadcasts.push({
        event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
        data: {
          phase: FinalRoundPhase.BIDDING,
          nextPhase: FinalRoundPhase.ANSWERING,
          timer,
        } satisfies FinalPhaseCompleteEventData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<FinalPhaseCompleteEventData>);
    }

    return {
      success: true,
      data: outputData,
      broadcast: broadcasts,
    };
  }
}

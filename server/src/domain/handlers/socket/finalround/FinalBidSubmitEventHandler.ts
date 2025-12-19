import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { GameActionType } from "domain/enums/GameActionType";
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

  protected override getActionType(): GameActionType {
    return GameActionType.FINAL_BID_SUBMIT;
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
    const { game, playerId, bidAmount, transitionResult } =
      await this.finalRoundService.handleFinalBidSubmit(
        context.socketId,
        data.bid
      );

    const outputData: FinalBidSubmitOutputData = { playerId, bidAmount };

    // Start with the bid submission broadcast
    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.FINAL_BID_SUBMIT,
        data: outputData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<FinalBidSubmitOutputData>,
    ];

    // If phase transitioned, add transition broadcasts directly (no rebuilding)
    if (transitionResult?.success) {
      for (const broadcast of transitionResult.broadcasts) {
        broadcasts.push({
          event: broadcast.event,
          data: broadcast.data,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        });
      }
    }

    return { success: true, data: outputData, broadcast: broadcasts };
  }
}

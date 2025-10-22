import { Socket } from "socket.io";

import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventBroadcast,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  EmptyInputData,
  GameStartBroadcastData,
  PlayerReadinessBroadcastData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";
import { GameActionExecutor } from "application/executors/GameActionExecutor";

/**
 * Handler for player ready events
 */
export class PlayerReadyEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  PlayerReadinessBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOGameService: SocketIOGameService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.PLAYER_READY;
  }

  protected async validateInput(
    _data: EmptyInputData
  ): Promise<EmptyInputData> {
    // No input validation needed for ready event
    return {};
  }

  protected async authorize(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer (player role check)
  }

  protected async execute(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<PlayerReadinessBroadcastData>> {
    // Execute the set ready logic
    const result = await this.socketIOGameService.setPlayerReadiness(
      this.socket.id,
      true
    );

    // Assign context variables for logging
    context.gameId = result.game.id;
    context.userId = this.socket.userId;

    const readyData: PlayerReadinessBroadcastData = {
      playerId: result.playerId,
      isReady: result.isReady,
      readyPlayers: result.readyPlayers,
      autoStartTriggered: result.shouldAutoStart,
    };

    const broadcasts: Array<
      SocketEventBroadcast<
        PlayerReadinessBroadcastData | GameStartBroadcastData
      >
    > = [
      {
        event: SocketIOGameEvents.PLAYER_READY,
        data: readyData,
        target: SocketBroadcastTarget.GAME,
        gameId: result.game.id,
      },
    ];

    // If auto-start should trigger, handle it and add start broadcast
    if (result.shouldAutoStart) {
      const autoStartResult = await this.socketIOGameService.handleAutoStart(
        result.game.id
      );

      if (autoStartResult) {
        const startEventPayload: GameStartBroadcastData = {
          currentRound: autoStartResult.gameState.currentRound!,
        };

        broadcasts.push({
          event: SocketIOGameEvents.START,
          data: startEventPayload,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
        });
      }
    }

    return {
      success: true,
      data: readyData,
      broadcast: broadcasts,
    };
  }
}

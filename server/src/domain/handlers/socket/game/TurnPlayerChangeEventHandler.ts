import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  TurnPlayerChangeBroadcastData,
  TurnPlayerChangeInputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

/**
 * Handler for turn player change events
 */
export class TurnPlayerChangeEventHandler extends BaseSocketEventHandler<
  TurnPlayerChangeInputData,
  TurnPlayerChangeBroadcastData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOGameService: SocketIOGameService,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.TURN_PLAYER_CHANGED;
  }

  protected async getGameIdForAction(
    _data: TurnPlayerChangeInputData,
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
    return GameActionType.TURN_PLAYER_CHANGE;
  }

  protected async validateInput(
    data: TurnPlayerChangeInputData
  ): Promise<TurnPlayerChangeInputData> {
    return GameValidator.validateTurnPlayerChange(data);
  }

  protected async authorize(
    _data: TurnPlayerChangeInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization handled by service layer
  }

  protected async execute(
    data: TurnPlayerChangeInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<TurnPlayerChangeBroadcastData>> {
    const result = await this.socketIOGameService.changeTurnPlayer(
      context.socketId,
      data.newTurnPlayerId
    );

    const broadcastData: TurnPlayerChangeBroadcastData = {
      newTurnPlayerId: data.newTurnPlayerId,
    };

    return {
      success: true,
      data: broadcastData,
      broadcast: [
        {
          event: SocketIOGameEvents.TURN_PLAYER_CHANGED,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: result.game.id,
        },
      ],
    };
  }
}

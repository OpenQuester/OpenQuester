import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketEventContext,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  ThemeEliminateInputData,
  ThemeEliminateOutputData,
} from "domain/types/socket/events/FinalRoundEventData";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class ThemeEliminateEventHandler extends BaseSocketEventHandler<
  ThemeEliminateInputData,
  ThemeEliminateOutputData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.THEME_ELIMINATE;
  }

  protected async getGameIdForAction(
    _data: ThemeEliminateInputData,
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
    return GameActionType.THEME_ELIMINATE;
  }

  protected async validateInput(
    data: ThemeEliminateInputData
  ): Promise<ThemeEliminateInputData> {
    return GameValidator.validateThemeElimination(data);
  }

  protected async authorize(
    _data: ThemeEliminateInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer
  }
}

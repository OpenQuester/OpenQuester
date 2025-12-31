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
  EmptyInputData,
  EmptyOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

/**
 * Socket event handler for skipping the show-answer phase.
 * Only the showman can skip this phase to speed up gameplay.
 */
export class SkipShowAnswerEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  EmptyOutputData
> {
  public constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.SKIP_SHOW_ANSWER;
  }

  protected async getGameIdForAction(
    _data: EmptyInputData,
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
    return GameActionType.SKIP_SHOW_ANSWER;
  }

  protected async validateInput(
    _data: EmptyInputData
  ): Promise<EmptyInputData> {
    return {};
  }

  protected async authorize(): Promise<void> {
    // Authorization handled in action handler
  }
}

import { Socket } from "socket.io";

import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class NextRoundEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  GameNextRoundEventPayload
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    private readonly socketIOGameService: SocketIOGameService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator
  ) {
    super(socket, eventEmitter, logger);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.NEXT_ROUND;
  }

  protected async validateInput(
    _data: EmptyInputData
  ): Promise<EmptyInputData> {
    // No input validation needed for next round event
    return {};
  }

  protected async authorize(
    _data: EmptyInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer (showman role check)
  }

  protected async execute(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<GameNextRoundEventPayload>> {
    // Execute the next round logic
    const { game, isGameFinished, nextGameState, questionData } =
      await this.socketIOGameService.handleNextRound(this.socket.id);

    // Assign context variables for logging
    context.gameId = game.id;
    context.userId = this.socket.userId;

    // Use the game progression coordinator to handle the complete flow
    const progressionResult =
      await this.gameProgressionCoordinator.processGameProgression({
        game,
        isGameFinished,
        nextGameState,
        questionFinishData: questionData
          ? {
              answerFiles: questionData.answerFiles ?? null,
              answerText: questionData.answerText ?? null,
              nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
            }
          : null,
      });

    return {
      success: progressionResult.success,
      data: progressionResult.data as GameNextRoundEventPayload,
      broadcast: progressionResult.broadcasts,
    };
  }
}

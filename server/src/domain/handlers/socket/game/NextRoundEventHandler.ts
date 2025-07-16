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
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
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
    private readonly socketIOGameService: SocketIOGameService
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

    const broadcasts: SocketEventBroadcast[] = [];

    // Always emit question finish if there was a current question
    if (questionData) {
      broadcasts.push({
        event: SocketIOGameEvents.QUESTION_FINISH,
        data: {
          answerFiles: questionData.answerFiles ?? null,
          answerText: questionData.answerText ?? null,
          nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
        } satisfies QuestionFinishEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      });
    }

    // Handle game finished scenario
    if (isGameFinished) {
      broadcasts.push({
        event: SocketIOGameEvents.GAME_FINISHED,
        data: true,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      });

      return {
        success: true,
        data: undefined,
        broadcast: broadcasts,
      };
    }

    // Handle next round scenario
    if (nextGameState) {
      const nextRoundPayload: GameNextRoundEventPayload = {
        gameState: nextGameState,
      };

      broadcasts.push({
        event: SocketIOGameEvents.NEXT_ROUND,
        data: nextRoundPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
        useRoleBasedBroadcast:
          nextGameState.currentRound?.type === PackageRoundType.FINAL,
      });

      return {
        success: true,
        data: nextRoundPayload,
        broadcast: broadcasts,
      };
    }

    return {
      success: true,
      data: undefined,
      broadcast: broadcasts,
    };
  }
}

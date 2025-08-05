import { Socket } from "socket.io";

import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
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
import {
  EmptyInputData,
  EmptyOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class SkipQuestionEventHandler extends BaseSocketEventHandler<
  EmptyInputData,
  EmptyOutputData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    super(socket, eventEmitter, logger);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.SKIP_QUESTION_FORCE;
  }

  protected async validateInput(
    _data: EmptyInputData
  ): Promise<EmptyInputData> {
    return {};
  }

  protected async authorize(): Promise<void> {
    // Authorization handled in service
  }

  protected async execute(
    _data: EmptyInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<EmptyOutputData>> {
    const { game, question } =
      await this.socketIOQuestionService.handleQuestionForceSkip(
        this.socket.id
      );
    const { isGameFinished, nextGameState } =
      await this.socketIOQuestionService.handleRoundProgression(game);

    // Assign context variables for logging
    context.gameId = game.id;
    context.userId = this.socket.userId;

    const finishPayload: QuestionFinishEventPayload = {
      answerFiles: question.answerFiles ?? null,
      answerText: question.answerText ?? null,
      nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
    };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.QUESTION_FINISH,
        data: finishPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      },
    ];

    if (isGameFinished) {
      broadcasts.push({
        event: SocketIOGameEvents.GAME_FINISHED,
        data: true,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      });
    } else if (nextGameState) {
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
    }

    return {
      success: true,
      data: {},
      broadcast: broadcasts,
    };
  }
}

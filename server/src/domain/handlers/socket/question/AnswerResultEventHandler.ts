import { Socket } from "socket.io";

import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventBroadcast,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { QuestionFinishWithAnswerEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import {
  AnswerResultData,
  AnswerResultType,
} from "domain/types/socket/game/AnswerResultData";
import { GameValidator } from "domain/validators/GameValidator";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class AnswerResultEventHandler extends BaseSocketEventHandler<
  AnswerResultData,
  QuestionAnswerResultEventPayload
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    super(socket, eventEmitter);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.ANSWER_RESULT;
  }

  protected async validateInput(data: AnswerResultData): Promise<any> {
    return GameValidator.validateAnswerResult(data);
  }

  protected async authorize(): Promise<void> {
    // Authorization handled in service
  }

  protected async execute(
    data: AnswerResultData
  ): Promise<SocketEventResult<QuestionAnswerResultEventPayload>> {
    const { playerAnswerResult, game, question, timer } =
      await this.socketIOQuestionService.handleAnswerResult(
        this.socket.id,
        data
      );

    // Handle correct answers with round progression
    if (playerAnswerResult.answerType === AnswerResultType.CORRECT) {
      const { isGameFinished, nextGameState } =
        await this.socketIOQuestionService.handleRoundProgression(game);

      const finishPayload: QuestionFinishWithAnswerEventPayload = {
        answerResult: playerAnswerResult,
        answerFiles: question!.answerFiles ?? null,
        answerText: question!.answerText ?? null,
        // nextTurnPlayerId is set to next turn player in handleAnswerResult
        nextTurnPlayerId: game.gameState.currentTurnPlayerId!,
      };

      const answerResultPayload: QuestionAnswerResultEventPayload = {
        answerResult: playerAnswerResult,
        timer: null,
      };

      const broadcasts: SocketEventBroadcast[] = [
        {
          event: SocketIOGameEvents.ANSWER_RESULT,
          data: answerResultPayload,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        },
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
        return {
          success: true,
          broadcast: broadcasts,
        };
      }

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
          data: answerResultPayload,
          broadcast: broadcasts,
        };
      }

      // For correct answers that don't trigger game finish or next round
      return {
        success: true,
        data: answerResultPayload,
        broadcast: broadcasts,
      };
    }

    // For wrong or skip answers
    const resultPayload: QuestionAnswerResultEventPayload = {
      answerResult: playerAnswerResult,
      timer,
    };

    return {
      success: true,
      data: resultPayload,
      broadcast: [
        {
          event: SocketIOGameEvents.ANSWER_RESULT,
          data: resultPayload,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        },
      ],
    };
  }
}

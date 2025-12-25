import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameProgressionCoordinator } from "application/services/game/GameProgressionCoordinator";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { Game } from "domain/entities/game/Game";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventBroadcast,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { QuestionFinishWithAnswerEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { AnswerResultData } from "domain/types/socket/game/AnswerResultData";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class AnswerResultEventHandler extends BaseSocketEventHandler<
  AnswerResultData,
  QuestionAnswerResultEventPayload
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly gameProgressionCoordinator: GameProgressionCoordinator,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.ANSWER_RESULT;
  }

  protected async getGameIdForAction(
    _data: AnswerResultData,
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
    return GameActionType.ANSWER_RESULT;
  }

  protected async validateInput(
    data: AnswerResultData
  ): Promise<AnswerResultData> {
    return GameValidator.validateAnswerResult(data);
  }

  protected async authorize(): Promise<void> {
    // Authorization handled in service
  }

  /**
   * Builds result when question finishes (correct answer or all players exhausted).
   * Handles round progression and emits QUESTION_FINISH event.
   */
  private async buildQuestionFinishResult(
    game: Game,
    playerAnswerResult: GameStateAnsweredPlayerData,
    questionData: PackageQuestionDTO | null
  ): Promise<SocketEventResult<QuestionAnswerResultEventPayload>> {
    const { isGameFinished, nextGameState } =
      await this.socketIOQuestionService.handleRoundProgression(game);

    const progressionResult =
      await this.gameProgressionCoordinator.processGameProgression({
        game,
        isGameFinished,
        nextGameState,
        questionFinishData: {
          answerFiles: questionData?.answerFiles ?? null,
          answerText: questionData?.answerText ?? null,
          nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
        },
      });

    const answerResultPayload: QuestionAnswerResultEventPayload = {
      answerResult: playerAnswerResult,
      timer: null,
    };

    const questionFinishWithAnswer: QuestionFinishWithAnswerEventPayload = {
      answerFiles: questionData?.answerFiles ?? null,
      answerText: questionData?.answerText ?? null,
      nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
      answerResult: playerAnswerResult,
    };

    // Replace basic QUESTION_FINISH with enhanced version containing answer result
    const additionalBroadcasts = progressionResult.broadcasts.filter(
      (broadcast) => broadcast.event !== SocketIOGameEvents.QUESTION_FINISH
    );

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.ANSWER_RESULT,
        data: answerResultPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      },
      {
        event: SocketIOGameEvents.QUESTION_FINISH,
        data: questionFinishWithAnswer,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      },
      ...additionalBroadcasts,
    ];

    return {
      success: true,
      data: answerResultPayload,
      broadcast: broadcasts,
    };
  }

  /**
   * Builds result when question continues (wrong/skip with players remaining).
   * Only emits ANSWER_RESULT, question stays in SHOWING state.
   */
  private buildContinueQuestionResult(
    game: Game,
    playerAnswerResult: GameStateAnsweredPlayerData,
    timer: GameStateTimerDTO | null
  ): SocketEventResult<QuestionAnswerResultEventPayload> {
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

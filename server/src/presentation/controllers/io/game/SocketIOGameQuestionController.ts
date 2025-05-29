import { Namespace, Socket } from "socket.io";

import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SocketEventEmitter } from "domain/types/socket/EmitTarget";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { QuestionAnswerEventPayload } from "domain/types/socket/events/game/QuestionAnswerEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import {
  QuestionFinishEventPayload,
  QuestionFinishWithAnswerEventPayload,
} from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { GameValidator } from "domain/validators/GameValidator";
import { SocketWrapper } from "infrastructure/socket/SocketWrapper";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class SocketIOGameQuestionController {
  constructor(
    private readonly socket: Socket,
    private readonly nsp: Namespace,
    private readonly eventEmitter: SocketIOEventEmitter,
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    this.socket.on(
      SocketIOGameEvents.QUESTION_PICK,
      SocketWrapper.catchErrors(this.eventEmitter, this.handleQuestionPick)
    );
    this.socket.on(
      SocketIOGameEvents.QUESTION_ANSWER,
      SocketWrapper.catchErrors(this.eventEmitter, this.handleQuestionAnswer)
    );
    this.socket.on(
      SocketIOGameEvents.ANSWER_SUBMITTED,
      SocketWrapper.catchErrors(this.eventEmitter, this.handleAnswerSubmitted)
    );
    this.socket.on(
      SocketIOGameEvents.ANSWER_RESULT,
      SocketWrapper.catchErrors(this.eventEmitter, this.handleAnswerResult)
    );
    this.socket.on(
      SocketIOGameEvents.SKIP_QUESTION_FORCE,
      SocketWrapper.catchErrors(this.eventEmitter, this.handleSkipQuestion)
    );
  }

  private handleSkipQuestion = async () => {
    const { game, question } =
      await this.socketIOQuestionService.handleQuestionSkip(this.socket.id);

    const { isGameFinished, nextGameState } =
      await this.socketIOQuestionService.handleRoundProgression(game);

    this.eventEmitter.emit<QuestionFinishEventPayload>(
      SocketIOGameEvents.QUESTION_FINISH,
      {
        answerFiles: question.answerFiles ?? null,
        answerText: question.answerText ?? null,
      },
      {
        emitter: SocketEventEmitter.IO,
        gameId: game.id,
      }
    );

    // Handle round progression on skip as well
    if (isGameFinished) {
      this.eventEmitter.emit(SocketIOGameEvents.GAME_FINISHED, true, {
        emitter: SocketEventEmitter.IO,
        gameId: game.id,
      });
      return;
    }

    if (nextGameState) {
      this.eventEmitter.emit<GameNextRoundEventPayload>(
        SocketIOGameEvents.NEXT_ROUND,
        { gameState: nextGameState },
        {
          emitter: SocketEventEmitter.IO,
          gameId: game.id,
        }
      );
      return;
    }
  };

  private handleQuestionPick = async (data: any) => {
    const dto = GameValidator.validatePickQuestion(data);

    const { question, game, timer } =
      await this.socketIOQuestionService.handleQuestionPick(
        this.socket.id,
        dto.questionId
      );

    await this._broadcastQuestion(game, question, timer);
  };

  private handleQuestionAnswer = async () => {
    const { userId, gameId, timer } =
      await this.socketIOQuestionService.handleQuestionAnswer(this.socket.id);

    this.eventEmitter.emit<QuestionAnswerEventPayload>(
      SocketIOGameEvents.QUESTION_ANSWER,
      {
        userId: userId!,
        timer: timer.value(),
      },
      { emitter: SocketEventEmitter.IO, gameId }
    );
  };

  private handleAnswerSubmitted = async (data: any) => {
    const dto = GameValidator.validateAnswerSubmitted(data);

    const game = await this.socketIOQuestionService.handleAnswerSubmitted(
      this.socket.id
    );

    this.eventEmitter.emit(SocketIOGameEvents.ANSWER_SUBMITTED, dto, {
      emitter: SocketEventEmitter.IO,
      gameId: game.id,
    });
  };

  private handleAnswerResult = async (data: any) => {
    const dto = GameValidator.validateAnswerResult(data);

    const { playerAnswerResult, game, question, timer } =
      await this.socketIOQuestionService.handleAnswerResult(
        this.socket.id,
        dto
      );

    // On correct just show correct answer
    if (playerAnswerResult.answerType === AnswerResultType.CORRECT) {
      const { isGameFinished, nextGameState } =
        await this.socketIOQuestionService.handleRoundProgression(game);

      this.eventEmitter.emit<QuestionFinishWithAnswerEventPayload>(
        SocketIOGameEvents.QUESTION_FINISH,
        {
          answerResult: playerAnswerResult,
          answerFiles: question!.answerFiles ?? null,
          answerText: question!.answerText ?? null,
        },
        {
          emitter: SocketEventEmitter.IO,
          gameId: game.id,
        }
      );

      // Handle game finish after last question (when no final round)
      if (isGameFinished) {
        this.eventEmitter.emit(SocketIOGameEvents.GAME_FINISHED, true, {
          emitter: SocketEventEmitter.IO,
          gameId: game.id,
        });
        return;
      }

      if (!nextGameState) {
        return;
      }

      // Next round if all questions played
      this.eventEmitter.emit<GameNextRoundEventPayload>(
        SocketIOGameEvents.NEXT_ROUND,
        { gameState: nextGameState },
        {
          emitter: SocketEventEmitter.IO,
          gameId: game.id,
        }
      );
      return;
    }

    // On wrong or skip send event to inform everyone about decision
    this.eventEmitter.emit<QuestionAnswerResultEventPayload>(
      SocketIOGameEvents.ANSWER_RESULT,
      {
        answerResult: playerAnswerResult,
        timer,
      },
      {
        emitter: SocketEventEmitter.IO,
        gameId: game.id,
      }
    );
  };

  private _broadcastQuestion = async (
    game: Game,
    question: PackageQuestionDTO,
    timer: GameStateTimer
  ) => {
    const sockets = await this.nsp.in(game.id).fetchSockets();
    const map = await this.socketIOQuestionService.getPlayersBroadcastMap(
      sockets.map((socket) => socket.id),
      game,
      question
    );

    for (const [socketId, questionData] of map) {
      this.eventEmitter.emitToSocket<GameQuestionDataEventPayload>(
        SocketIOGameEvents.QUESTION_DATA,
        { data: questionData, timer: timer.value() },
        socketId
      );
    }
  };
}

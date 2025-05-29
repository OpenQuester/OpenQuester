import { Server as IOServer, Namespace } from "socket.io";

import { GameService } from "application/services/game/GameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { REDIS_LOCK_EXPIRATION_KEY } from "domain/constants/redis";
import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { TIMER_NSP } from "domain/constants/timer";
import { Game } from "domain/entities/game/Game";
import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { ErrorController } from "domain/errors/ErrorController";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { RedisExpirationHandler } from "domain/types/redis/RedisExpirationHandler";
import { GameNextRoundEventPayload } from "domain/types/socket/events/game/GameNextRoundEventPayload";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { RedisService } from "infrastructure/services/redis/RedisService";

export class TimerExpirationHandler implements RedisExpirationHandler {
  private _gameNsp?: Namespace;

  constructor(
    private readonly io: IOServer,
    private readonly gameService: GameService,
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly redisService: RedisService
  ) {
    //
  }

  public supports(key: string): boolean {
    return key.startsWith(`${TIMER_NSP}:`);
  }

  public async handle(key: string): Promise<void> {
    const lockKey = `${REDIS_LOCK_EXPIRATION_KEY}:${key}`;
    const acquired = await this.redisService.setLockKey(lockKey);

    if (!acquired) {
      return; // Another instance acquired the lock
    }

    const gameId = key.split(":")[1];

    try {
      const game = await this.gameService.getGameEntity(
        gameId,
        GAME_TTL_IN_SECONDS
      );
      const question = await this.socketIOQuestionService.getCurrentQuestion(
        game
      );

      if (game.gameState.questionState === QuestionState.SHOWING) {
        game.resetToChoosingState();
        await this.gameService.updateGame(game);

        this._gameNamespace
          .to(gameId)
          .emit(SocketIOGameEvents.QUESTION_FINISH, {
            answerFiles: question.answerFiles ?? null,
            answerText: question.answerText ?? null,
          } satisfies QuestionFinishEventPayload);

        if (!game.isAllQuestionsPlayed()) {
          return;
        }

        // Next round if all questions played
        const { isGameFinished, nextGameState } = game.handleRoundProgression();

        if (isGameFinished || nextGameState) {
          await this.gameService.updateGame(game);
        }

        if (isGameFinished) {
          this._gameNamespace
            .to(gameId)
            .emit(SocketIOGameEvents.GAME_FINISHED, true);
          return;
        }

        if (nextGameState) {
          this._gameNamespace.to(gameId).emit(SocketIOGameEvents.NEXT_ROUND, {
            gameState: nextGameState,
          } satisfies GameNextRoundEventPayload);
          return;
        }
      }

      if (game.gameState.questionState === QuestionState.ANSWERING) {
        const { answerResult, timer } = await this._handleAnsweringExpiration(
          game,
          question
        );

        this._gameNamespace.to(gameId).emit(SocketIOGameEvents.ANSWER_RESULT, {
          answerResult,
          timer,
        } satisfies QuestionAnswerResultEventPayload);
        return;
      }
    } catch (err: unknown) {
      const error = await ErrorController.resolveError(err);
      this._gameNamespace.to(gameId).emit(SocketIOEvents.ERROR, {
        message: error.message,
      });
    }
  }

  private async _handleAnsweringExpiration(
    game: Game,
    question: PackageQuestionDTO
  ) {
    // On time expiration we always accept answer as wrong with x1 score value
    const nextState = QuestionState.SHOWING;

    const playerAnswerResult = game.handleQuestionAnswer(
      -question.price,
      AnswerResultType.WRONG,
      nextState
    );

    const timer = await this.gameService.getTimer(
      game.id,
      QuestionState.SHOWING
    );

    game.setTimer(timer);
    await this.gameService.updateGame(game);
    if (timer) {
      await this.gameService.saveTimer(
        timer,
        game.id,
        timer.durationMs - timer.elapsedMs
      );
    }

    return { answerResult: playerAnswerResult, timer };
  }

  private get _gameNamespace() {
    if (!this._gameNsp) {
      this._gameNsp = this.io.of(SOCKET_GAME_NAMESPACE);
    }

    return this._gameNsp;
  }
}

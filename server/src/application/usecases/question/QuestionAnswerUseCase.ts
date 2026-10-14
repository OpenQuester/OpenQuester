import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { GAME_QUESTION_ANSWER_SUBMIT_TIME } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { BuzzerLogic } from "domain/logic/question/BuzzerLogic";
import { QuestionAnswerRequestLogic } from "domain/logic/question/QuestionAnswerRequestLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  type DataMutation,
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BuzzerFalseStartEventPayload } from "domain/types/socket/events/game/BuzzerFalseStartEventPayload";
import { QuestionAnswerEventPayload } from "domain/types/socket/events/game/QuestionAnswerEventPayload";
import { EmptyInputData } from "domain/types/socket/events/SocketEventInterfaces";

/** What a buzzer press led to */
export type QuestionAnswerOutcome =
  | ({ outcome: "answering" } & QuestionAnswerEventPayload)
  | { outcome: "false-start"; lockedUntil: number }
  | { outcome: "pressed" };

/**
 * Handles player answering a question (buzzer press).
 *
 * In a race (no designated answerer) the press follows the buzzer rules in
 * {@link BuzzerLogic}: a press before the buzzer opens is a false start, and
 * the first press in time opens a short accept window whose presses are drawn
 * at random when it closes (TimerExpirationService resolves it on the active
 * timer key). A designated answerer's press answers straight away.
 *
 * Context-aware: receives prefetched game/player/timer from the executor's
 * IN pipeline. Saves elapsed timer via mutation, delegates state transition
 * to PhaseTransitionRouter, and returns game-dirty flag for the OUT pipeline.
 */
export class QuestionAnswerUseCase
  implements GameActionHandler<EmptyInputData, QuestionAnswerOutcome>
{
  constructor(
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly socketGameTimerService: SocketGameTimerService
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<QuestionAnswerOutcome>> {
    const { game, currentPlayer } = ctx;

    // Pure validation
    QuestionAnswerRequestLogic.validate(game, currentPlayer);

    const playerId = currentPlayer!.meta.id;
    const now = Date.now();

    if (BuzzerLogic.isRace(game)) {
      if (BuzzerLogic.lockedUntil(game, playerId, now)) {
        throw new ClientError(ClientResponse.BUZZER_LOCKED);
      }

      if (!BuzzerLogic.isOpen(game, now)) {
        return this._falseStart(ctx, playerId, now);
      }

      if (BuzzerLogic.acceptWindowMs(game) > 0) {
        return this._pressInWindow(ctx, playerId, now);
      }
    }

    return this._answerNow(ctx, playerId);
  }

  private _falseStart(
    ctx: ActionExecutionContext<EmptyInputData>,
    playerId: number,
    now: number
  ): ActionHandlerResult<QuestionAnswerOutcome> {
    const { game } = ctx;
    const lockedUntil = BuzzerLogic.lockFalseStart(game, playerId, now);

    return {
      success: true,
      data: { outcome: "false-start", lockedUntil },
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        DataMutationConverter.gameBroadcastMutation(
          game.id,
          SocketIOGameEvents.BUZZER_FALSE_START,
          {
            playerId,
            lockMs: lockedUntil - now,
          } satisfies BuzzerFalseStartEventPayload
        ),
      ],
      broadcastGame: game,
    };
  }

  private _pressInWindow(
    ctx: ActionExecutionContext<EmptyInputData>,
    playerId: number,
    now: number
  ): ActionHandlerResult<QuestionAnswerOutcome> {
    const { game } = ctx;
    const opened = BuzzerLogic.recordPress(game, playerId, now);
    const mutations: DataMutation[] = [DataMutationConverter.saveGameMutation(game)];

    if (opened && game.gameState.timer) {
      // Expire the active timer when the window closes; its expiration draws
      // the answerer. The SHOWING timer itself is untouched in game state.
      mutations.push(
        DataMutationConverter.setTimerMutation(
          timerKey(game.id),
          JSON.stringify(game.gameState.timer),
          BuzzerLogic.acceptWindowMs(game)
        )
      );
    }

    return {
      success: true,
      data: { outcome: "pressed" },
      mutations,
      broadcastGame: game,
    };
  }

  private async _answerNow(
    ctx: ActionExecutionContext<EmptyInputData>,
    playerId: number
  ): Promise<ActionHandlerResult<QuestionAnswerOutcome>> {
    const { game } = ctx;

    // Build save-elapsed-timer mutation (deferred to OUT pipeline)
    const timerMutations: DataMutation[] = [];
    if (game.gameState.timer) {
      const saveMutation =
        this.socketGameTimerService.buildSaveElapsedTimerMutation(
          game,
          GAME_QUESTION_ANSWER_SUBMIT_TIME,
          QuestionState.SHOWING
        );
      timerMutations.push(
        ...DataMutationConverter.mutationFromTimerMutations([saveMutation])
      );
    }

    // Execute state transition (SHOWING → ANSWERING)
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { playerId, isSystem: false },
    });

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    const timerDto = transitionResult.timer;
    const timer = timerDto ? GameStateTimer.fromDTO(timerDto) : null;

    if (!timer) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    // Build result with broadcasts
    const result = QuestionAnswerRequestLogic.buildResult({
      game,
      playerId,
      timer,
    });

    return {
      success: true,
      data: { outcome: "answering", userId: playerId, timer: timer.value()! },
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...timerMutations,
        ...DataMutationConverter.mutationFromTimerMutations(
          transitionResult.timerMutations
        ),
        ...DataMutationConverter.mutationFromSocketBroadcasts(
          result.broadcasts
        ),
      ],
      broadcastGame: game,
    };
  }
}

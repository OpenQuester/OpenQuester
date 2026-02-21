import { GameService } from "application/services/game/GameService";
import { timerKey } from "domain/constants/redisKeys";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GamePauseLogic } from "domain/logic/timer/GamePauseLogic";
import { QuestionAnswerResultLogic } from "domain/logic/question/QuestionAnswerResultLogic";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { BaseTransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  getGamePhase,
  MutationResult,
  TimerResult,
  TransitionTrigger,
} from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import {
  AnsweringToShowingCtx,
  AnsweringToShowingMutationData,
} from "domain/types/socket/transition/answering";
import { PackageQuestionType } from "domain/enums/package/QuestionType";

/**
 * Handles transition from ANSWERING to SHOWING phase in regular rounds.
 *
 * This transition occurs when:
 * - Player's answer is marked wrong or skip by showman
 * - Player's answering timer expires (auto-wrong)
 *
 * Entry points:
 * - Showman marks answer as wrong (SocketIOQuestionService.handleAnswerResult)
 * - Answering timer expires (TimerExpirationService.handleAnsweringExpiration)
 */
export class AnsweringToShowingHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.ANSWERING;
  public readonly toPhase = GamePhase.SHOWING;

  constructor(
    gameService: GameService
  ) {
    super(gameService);
  }

  /**
   * Check if this transition should occur.
   *
   * Validates:
   * 1. Current phase must be ANSWERING
   * 2. Game in progress with simple round
   * 3. Must have answer result payload with WRONG answer type
   * 4. Not all players will be exhausted after this answer (otherwise go to SHOWING_ANSWER)
   */
  public canTransition(ctx: AnsweringToShowingCtx): boolean {
    const { game, trigger, payload } = ctx;

    // 1. Verify we're in the expected phase
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Must be simple round in ANSWERING state
    if (
      !TransitionGuards.canTransitionInRegularRound(
        game,
        QuestionState.ANSWERING
      )
    ) {
      return false;
    }

    // 3. Must have answer result or timer expiration
    if (
      trigger === TransitionTrigger.USER_ACTION ||
      trigger === TransitionTrigger.PLAYER_LEFT
    ) {
      const answerType = payload?.answerType;
      return (
        answerType !== AnswerResultType.CORRECT && // skip or wrong
        !game.willAllPlayersBeExhausted() && // someone still can answer after this
        payload?.questionType === PackageQuestionType.SIMPLE // Secret and stake always go to SHOWING_ANSWER
      );
    }

    // 4. Not all players will be exhausted - if they will be, we go to SHOWING_ANSWER instead
    if (game.willAllPlayersBeExhausted()) {
      return false;
    }

    return true;
  }

  protected override validate(ctx: AnsweringToShowingCtx): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  /** This called only on Skip, wrong, or timer expired (which is auto-wrong) answer */
  protected async mutate(ctx: AnsweringToShowingCtx): Promise<MutationResult> {
    const { game, payload } = ctx;
    const answeringPlayer = game.gameState.answeringPlayer;

    // Get score result from payload or default to current question price (negative)
    // When timer expires with no payload, use negative question price as penalty
    const currentQuestionPrice = game.gameState.currentQuestion?.price ?? 0;
    const scoreResult = payload?.scoreResult ?? -currentQuestionPrice;
    const answerType = payload?.answerType ?? AnswerResultType.WRONG;

    const playerAnswerResult = game.handleQuestionAnswer(
      scoreResult,
      answerType,
      QuestionState.SHOWING
    );

    return {
      data: {
        answeringPlayer,
        playerAnswerResult,
      } satisfies AnsweringToShowingMutationData,
    };
  }

  protected async handleTimer(
    ctx: AnsweringToShowingCtx,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;
    const timerMutations: TimerResult["timerMutations"] = [
      { op: "delete", key: timerKey(game.id) },
    ];

    // Restore the saved showing timer (saved when player requested to answer)
    const savedTimer = await this.gameService.getTimer(
      game.id,
      QuestionState.SHOWING
    );

    if (savedTimer) {
      // Update timer with resumedAt timestamp to indicate it was restored
      GamePauseLogic.updateTimerForResume(savedTimer);

      // Set the restored timer on game state
      game.gameState.timer = savedTimer;

      return {
        timer: savedTimer,
        timerMutations,
      };
    }

    // Fallback: if no saved timer, set timer to null
    game.gameState.timer = null;
    return { timer: undefined, timerMutations };
  }

  protected collectBroadcasts(
    ctx: AnsweringToShowingCtx,
    mutationResult: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[] {
    const mutationData = mutationResult.data as AnsweringToShowingMutationData;

    return [
      {
        event: SocketIOGameEvents.ANSWER_RESULT,
        data: QuestionAnswerResultLogic.buildSocketPayload({
          answerResult: mutationData.playerAnswerResult,
          timer: timerResult.timer ?? null,
        }),
        room: ctx.game.id,
      },
    ];
  }
}

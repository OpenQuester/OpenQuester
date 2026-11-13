import { GAME_TTL_IN_SECONDS } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { SECOND_MS } from "domain/constants/time";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { AnsweringToShowingAnswerHandler } from "domain/state-machine/handlers/regular-round/AnsweringToShowingAnswerHandler";
import {
  GamePhase,
  getGamePhase,
  type MutationResult,
  type TimerResult,
  TransitionTrigger
} from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import type { AnsweringToShowingAnswerCtx } from "domain/types/socket/transition/answering";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/** Settle a designated answerer's permanent departure before their window opens. */
export class DirectMediaToShowingAnswerHandler extends AnsweringToShowingAnswerHandler {
  public override readonly fromPhase = GamePhase.MEDIA_DOWNLOADING;

  public override canTransition(ctx: AnsweringToShowingAnswerCtx): boolean {
    const { game, trigger, triggeredBy, payload } = ctx;
    const { answeringPlayer, currentQuestion } = game.gameState;
    return (
      getGamePhase(game) === this.fromPhase &&
      TransitionGuards.isSimpleRound(game) &&
      (currentQuestion?.type === PackageQuestionType.SECRET ||
        currentQuestion?.type === PackageQuestionType.STAKE) &&
      answeringPlayer != null &&
      answeringPlayer === triggeredBy.playerId &&
      trigger === TransitionTrigger.PLAYER_LEFT &&
      payload?.answerType === AnswerResultType.SKIP
    );
  }

  protected override validate({ game }: AnsweringToShowingAnswerCtx): void {
    GameStateValidator.validateGameStarted(game);
    GameStateValidator.validateGameNotFinished(game);
  }

  protected override async handleTimer(
    ctx: AnsweringToShowingAnswerCtx,
    mutationResult: MutationResult
  ): Promise<TimerResult> {
    const reveal = await super.handleTimer(ctx, mutationResult);
    const { game } = ctx;
    if (!game.gameState.isPaused) {
      return reveal;
    }

    const timer = reveal.timer!;
    if (game.gameState.pausedAt != null) {
      // The reveal will start on resume. It has no lead left over from preparation.
      timer.startedAt = new Date(game.gameState.pausedAt);
    }
    game.setTimer(null);
    return {
      timer,
      timerMutations: [
        { op: "delete", key: timerKey(game.id) },
        { op: "delete", key: timerKey(game.id, QuestionState.MEDIA_DOWNLOADING) },
        {
          op: "set",
          key: timerKey(game.id, QuestionState.SHOWING_ANSWER),
          value: JSON.stringify(timer),
          pxTtl: Math.ceil(GAME_TTL_IN_SECONDS * SECOND_MS * 1.25)
        }
      ]
    };
  }
}

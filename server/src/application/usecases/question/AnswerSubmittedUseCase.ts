import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { AnswerResultUseCase } from "application/usecases/question/AnswerResultUseCase";
import { type Game } from "domain/entities/game/Game";
import { AnswerType } from "domain/enums/package/AnswerType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { AnswerCheckLogic } from "domain/logic/question/AnswerCheckLogic";
import { AnswerSubmittedLogic } from "domain/logic/question/AnswerSubmittedLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import {
  AnswerSubmittedBroadcastData,
  AnswerSubmittedInputData
} from "domain/types/socket/events/SocketEventInterfaces";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";

/**
 * Handles answer submission.
 *
 * Context-aware: receives prefetched game/player from the executor's
 * IN pipeline and returns pure results — no Redis calls.
 *
 * Usually read-only: the typed answer goes to the showman, who judges it.
 * Choice, number and point answers are checked by the server instead
 * ({@link AnswerCheckLogic}) and judged right away.
 */
export class AnswerSubmittedUseCase implements GameActionHandler<
  AnswerSubmittedInputData,
  AnswerSubmittedBroadcastData
> {
  constructor(
    private readonly answerResultUseCase: AnswerResultUseCase,
    private readonly transitionResourceService: TransitionResourceService
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<AnswerSubmittedInputData>
  ): Promise<ActionHandlerResult<AnswerSubmittedBroadcastData>> {
    const { game, currentPlayer } = ctx;
    AnswerSubmittedLogic.validate(game, currentPlayer);

    const answerText = ctx.action.payload.answerText;
    const result = AnswerSubmittedLogic.buildResult({ game, answerText });
    const submitted = DataMutationConverter.mutationFromSocketBroadcasts(result.broadcasts);

    const verdict = await this._check(game, answerText);
    if (verdict === null) {
      return {
        success: true,
        data: result.data,
        mutations: submitted,
        broadcastGame: game
      };
    }

    const price = game.gameState.currentQuestion?.price ?? 0;
    const judged = await this.answerResultUseCase.judge(game, currentPlayer!.meta.id, {
      answerType: verdict ? AnswerResultType.CORRECT : AnswerResultType.WRONG,
      scoreResult: verdict ? price : -price
    });

    return {
      ...judged,
      data: result.data,
      mutations: [...submitted, ...judged.mutations]
    };
  }

  /** Choice, number and point answers are judged by the server */
  private async _check(game: Game, answerText: string | null): Promise<boolean | null> {
    const current = game.gameState.currentQuestion;
    const checkable =
      current?.type === PackageQuestionType.CHOICE ||
      (!!current?.answerType && current.answerType !== AnswerType.TEXT);
    if (!checkable) {
      return null;
    }

    const resources = await this.transitionResourceService.getCurrentQuestionWithTheme(game);

    return AnswerCheckLogic.check(resources?.questionWithTheme?.question, answerText);
  }
}

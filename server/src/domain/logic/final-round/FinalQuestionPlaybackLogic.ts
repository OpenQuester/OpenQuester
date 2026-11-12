import { answerFormat } from "domain/logic/question/answerFormat";
import { AnswerType } from "domain/enums/package/AnswerType";
import { Game } from "domain/entities/game/Game";
import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";

/** Whether sequenced final content has finished on the authoritative phase timer. */
export class FinalQuestionPlaybackLogic {
  public static presentationDuration(game: Game): number {
    const data = game.gameState.finalRoundData?.questionData;
    const optionsMs =
      answerFormat(data?.question) === AnswerType.SELECT
        ? Math.max(0, data?.question.showDelay ?? 0)
        : 0;
    return (data?.contentPlan?.totalMs ?? 0) + optionsMs;
  }

  public static isPlaybackComplete(game: Game): boolean {
    return QuestionContentPlanLogic.isPresentationComplete(game, this.presentationDuration(game));
  }
}

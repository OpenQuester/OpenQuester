import {
  SHOW_ANSWER_DURATION_AUDIO,
  SHOW_ANSWER_DURATION_TEXT,
  SHOW_ANSWER_DURATION_VIDEO
} from "domain/constants/game";
import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";
import { QuestionContentPlanDTO } from "domain/types/dto/game/state/QuestionContentPlanDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";

/**
 * Logic class for handling show answer phase.
 * Extracts business logic for answer showing timer and broadcasts.
 */
export class ShowAnswerLogic {
  /**
   * Timeline of the answer files, played one step at a time on the
   * SHOWING_ANSWER timer. The answer text stays visible as the headline.
   */
  public static buildAnswerPlan(
    question: Pick<PackageQuestionDTO, "answerFiles"> | null
  ): QuestionContentPlanDTO | null {
    if (!question?.answerFiles?.length) {
      return null;
    }

    return QuestionContentPlanLogic.build(
      { files: question.answerFiles },
      null,
      {
        imageMs: SHOW_ANSWER_DURATION_TEXT,
        audioMs: SHOW_ANSWER_DURATION_AUDIO,
        videoMs: SHOW_ANSWER_DURATION_VIDEO
      }
    );
  }

  /**
   * Calculate the duration for showing the answer.
   * Based on the answer files timeline, or the question's showAnswerDuration.
   */
  public static calculateShowAnswerDuration(question: PackageQuestionDTO | null): number {
    if (!question) {
      return SHOW_ANSWER_DURATION_TEXT;
    }

    const plan = this.buildAnswerPlan(question);

    if (plan) {
      return plan.totalMs > 0 ? plan.totalMs : SHOW_ANSWER_DURATION_TEXT;
    }

    return question.showAnswerDuration > 0
      ? question.showAnswerDuration
      : SHOW_ANSWER_DURATION_TEXT;
  }
}

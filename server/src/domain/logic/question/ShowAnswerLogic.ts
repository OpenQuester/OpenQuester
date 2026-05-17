import {
  SHOW_ANSWER_DURATION_AUDIO,
  SHOW_ANSWER_DURATION_TEXT,
  SHOW_ANSWER_DURATION_VIDEO
} from "domain/constants/game";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PackageFileType } from "domain/enums/package/PackageFileType";

/**
 * Logic class for handling show answer phase.
 * Extracts business logic for answer showing timer and broadcasts.
 */
export class ShowAnswerLogic {
  /**
   * Calculate the duration for showing the answer.
   * Based on answer files (media stacking) or fallback default.
   */
  public static calculateShowAnswerDuration(question: PackageQuestionDTO | null): number {
    if (!question) {
      return SHOW_ANSWER_DURATION_TEXT;
    }

    const { answerFiles } = question;

    if (answerFiles && answerFiles.length > 0) {
      let duration = 0;
      for (const file of answerFiles) {
        if (file.displayTime && file.displayTime > 0) {
          duration += file.displayTime;
        } else {
          switch (file.file.type) {
            case PackageFileType.VIDEO:
              duration += SHOW_ANSWER_DURATION_VIDEO;
              break;
            case PackageFileType.AUDIO:
              duration += SHOW_ANSWER_DURATION_AUDIO;
              break;
            // Images and text use the text duration
            case PackageFileType.IMAGE:
            default:
              duration += SHOW_ANSWER_DURATION_TEXT;
              break;
          }
        }
      }
      return duration > 0 ? duration : SHOW_ANSWER_DURATION_TEXT;
    }

    return question.showAnswerDuration > 0
      ? question.showAnswerDuration
      : SHOW_ANSWER_DURATION_TEXT;
  }
}

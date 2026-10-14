import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionContentPlanDTO } from "domain/types/dto/game/state/QuestionContentPlanDTO";
import { PackageAnswerFileDTO } from "domain/types/dto/package/PackageAnswerFileDTO";

export interface QuestionFinishEventPayload {
  answerFiles: PackageAnswerFileDTO[] | null;
  answerText: string | null;
  nextTurnPlayerId: number | null;
  /** Answer files timeline on the SHOWING_ANSWER timer */
  answerContentPlan?: QuestionContentPlanDTO | null;
  /** Other answers that also counted as right */
  rightAnswers?: string[] | null;
  /** Who wrote the question */
  authors?: string[] | null;
  /** Where the facts come from */
  sources?: string[] | null;
}

export interface QuestionFinishWithAnswerEventPayload
  extends Pick<
    QuestionFinishEventPayload,
    "answerFiles" | "answerText" | "nextTurnPlayerId" | "answerContentPlan" | "rightAnswers" | "authors" | "sources"
  > {
  answerResult: GameStateAnsweredPlayerData;
}

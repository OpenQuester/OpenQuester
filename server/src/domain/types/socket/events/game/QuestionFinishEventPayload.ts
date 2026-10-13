import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { QuestionContentPlanDTO } from "domain/types/dto/game/state/QuestionContentPlanDTO";
import { PackageAnswerFileDTO } from "domain/types/dto/package/PackageAnswerFileDTO";

export interface QuestionFinishEventPayload {
  answerFiles: PackageAnswerFileDTO[] | null;
  answerText: string | null;
  nextTurnPlayerId: number | null;
  /** Answer files timeline on the SHOWING_ANSWER timer */
  answerContentPlan?: QuestionContentPlanDTO | null;
}

export interface QuestionFinishWithAnswerEventPayload
  extends Pick<
    QuestionFinishEventPayload,
    "answerFiles" | "answerText" | "nextTurnPlayerId" | "answerContentPlan"
  > {
  answerResult: GameStateAnsweredPlayerData;
}

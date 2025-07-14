import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { PackageAnswerFileDTO } from "domain/types/dto/package/PackageAnswerFileDTO";

export interface QuestionFinishEventPayload {
  answerFiles: PackageAnswerFileDTO[] | null;
  answerText: string | null;
  nextTurnPlayerId: number | null;
}

export interface QuestionFinishWithAnswerEventPayload
  extends Pick<
    QuestionFinishEventPayload,
    "answerFiles" | "answerText" | "nextTurnPlayerId"
  > {
  answerResult: GameStateAnsweredPlayerData;
}

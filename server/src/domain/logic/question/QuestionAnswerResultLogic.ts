import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionAnswerResultEventPayload } from "domain/types/socket/events/game/QuestionAnswerResultEventPayload";

interface QuestionAnswerResultBuildInput {
  answerResult: GameStateAnsweredPlayerData;
  timer: GameStateTimerDTO | null;
}

export class QuestionAnswerResultLogic {
  public static buildSocketPayload(
    input: QuestionAnswerResultBuildInput
  ): QuestionAnswerResultEventPayload {
    const { answerResult, timer } = input;

    return {
      answerResult,
      timer,
    } satisfies QuestionAnswerResultEventPayload;
  }
}

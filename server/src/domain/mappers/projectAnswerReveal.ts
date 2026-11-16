import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import type { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";

/** Revealed screen content is public; spoken showman text stays private after reveal. */
export function projectAnswerReveal<T extends QuestionFinishEventPayload>(
  data: T,
  showman = false
): T {
  if (showman || !data.answerTextItems?.some((item) => item.placement === "replic")) {
    return data;
  }
  return { ...data, answerTextItems: GameQuestionMapper.mapPublicTextItems(data.answerTextItems) };
}

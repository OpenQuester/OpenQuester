import { newId, type DraftQuestion } from "../packageDraft";
import { correctChoice } from "../choiceCorrectness";
export type QuestionFieldsProps = {
  q: DraftQuestion;
  set: (patch: Partial<DraftQuestion>) => void;
};
/** Switching type preserves the question and creates initial choices only once. */
export function changeQuestionType(
  q: DraftQuestion,
  type: DraftQuestion["type"],
): Partial<DraftQuestion> {
  if (type === "choice" && q.options.length === 0)
    return {
      type,
      options: [
        { id: newId(), text: q.answerText, file: null },
        { id: newId(), text: "", file: null },
      ],
    };
  return { type, ...(q.type === "choice" && type !== "choice" ? { answerType: "select" } : {}) };
}

export function editChoiceText(q: DraftQuestion, id: string, text: string): Partial<DraftQuestion> {
  const old = correctChoice(q);
  const wasCorrect = old?.id === id && q.answerText === old.text;
  return {
    options: q.options.map((o) => (o.id === id ? { ...o, text } : o)),
    ...(wasCorrect ? { answerText: text } : {}),
  };
}

/** Keep separately authored reveal text when selecting an image-only option. */
export function selectChoice(q: DraftQuestion, id: string): Partial<DraftQuestion> {
  const option = q.options.find((item) => item.id === id);
  if (!option) return {};
  const previous = correctChoice(q);
  const answerText =
    option.text || (previous && q.answerText === previous.text ? "" : q.answerText);
  return {
    correctChoiceOptionId: id,
    answerText,
    compatibilityIssues: q.compatibilityIssues?.filter((issue) => issue.feature !== "select"),
  };
}

/** Explicitly discards unsupported imported behavior, retaining the visible prompt and reveal. */
export function convertImportedQuestionToSimple(): Partial<DraftQuestion> {
  return {
    type: "simple",
    script: undefined,
    compatibilityIssues: undefined,
    secretRules: undefined,
    realPrice: undefined,
    forEveryone: false,
    allowedPrices: [],
    answerType: "text",
    answerNumber: null,
    answerPoint: null,
    answerDeviation: null,
    options: [],
    selectSource: undefined,
    correctChoiceOptionId: undefined,
  };
}

import { newId, type DraftQuestion } from "../packageDraft";
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
  return { type };
}

export function editChoiceText(q: DraftQuestion, id: string, text: string): Partial<DraftQuestion> {
  const old = q.options.find((o) => o.id === id);
  const correct = q.answerText.trim();
  const wasCorrect = old && old.text.trim() === correct && correct !== "";
  return {
    options: q.options.map((o) => (o.id === id ? { ...o, text } : o)),
    ...(wasCorrect ? { answerText: text } : {}),
  };
}

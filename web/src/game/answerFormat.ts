export type AnswerFormat = "text" | "number" | "point" | "select";

/** Legacy choice keeps its select input without changing the question mechanics. */
export function answerFormat(
  question:
    | {
        type: string;
        answerType?: AnswerFormat | null;
      }
    | null
    | undefined,
): AnswerFormat {
  return question?.type === "choice" ? "select" : (question?.answerType ?? "text");
}

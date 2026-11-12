import { answerFormat } from "@/game/answerFormat";
import type { Question } from "@/game/protocol";
import { ChoiceMedia } from "../question/ChoiceMedia";
import { stageStyles } from "./stageStyles";
import { useTranslation } from "react-i18next";

/** Shared controls; the owning stage supplies its scoring labels and event. */
export function AnswerReviewActions({
  correct,
  wrong,
  onReview,
  testIdPrefix,
}: {
  correct: string;
  wrong: string;
  onReview: (isCorrect: boolean) => void;
  testIdPrefix?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className={stageStyles.correctReview}
        onClick={() => onReview(true)}
        data-testid={testIdPrefix && `${testIdPrefix}-correct`}
      >
        {t("judge.correct")} {correct}
      </button>
      <button
        type="button"
        className={stageStyles.wrongReview}
        onClick={() => onReview(false)}
        data-testid={testIdPrefix && `${testIdPrefix}-wrong`}
      >
        {t("judge.wrong")} {wrong}
      </button>
    </div>
  );
}

function reviewedChoice(question: Question | null | undefined, order: number | null | undefined) {
  if (order == null || answerFormat(question) !== "select") return;
  const options = question?.answers ?? [];
  const matches = options.filter((option) => option.order === order);
  if (matches.length !== 1) return;
  return {
    option: matches[0]!,
    position: options.filter((option) => option.order < order).length + 1,
  };
}

/** The stage supplies option data only to the showman. */
export function ReviewedAnswer({
  answer,
  question,
  choiceOrder,
  paused,
  kind = "submission",
}: {
  answer?: string | null;
  question?: Question | null;
  choiceOrder?: number | null;
  paused?: boolean;
  kind?: "key" | "submission";
}) {
  const { t } = useTranslation();
  const choice = reviewedChoice(question, choiceOrder);
  if (kind === "key" && !answer && !choice) return null;

  const label = choice
    ? choice.option.sourceLabel || t("question.optionNumber", { n: choice.position })
    : null;
  const text = choice?.option.text;
  const title = label && text ? `${label} · ${text}` : (label ?? answer);
  const content = (
    <>
      <span
        className={
          kind === "key"
            ? "text-xl font-semibold text-success [overflow-wrap:anywhere]"
            : "text-lg [overflow-wrap:anywhere]"
        }
      >
        {title}
      </span>
      {choice?.option.file && (
        <ChoiceMedia file={choice.option.file} label={title ?? ""} paused={paused} />
      )}
    </>
  );
  return kind === "key" ? (
    <div className={stageStyles.correctAnswer}>
      <span className="text-sm text-muted">{t("reveal.answer")}</span>
      {content}
    </div>
  ) : (
    content
  );
}

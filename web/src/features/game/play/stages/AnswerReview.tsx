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

/** Visibility remains the owning stage's decision, including showman-only data. */
export function ReviewedCorrectAnswer({ answer }: { answer?: string | null }) {
  const { t } = useTranslation();
  return (
    <div className={stageStyles.correctAnswer}>
      <span className="text-sm text-muted">{t("reveal.answer")}</span>
      <span className="text-xl font-semibold text-success">{answer}</span>
    </div>
  );
}

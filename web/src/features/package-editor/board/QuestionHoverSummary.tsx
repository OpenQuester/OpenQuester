import { useTranslation } from "react-i18next";
import type { DraftQuestion } from "../packageDraft";

/** A pointer-only tooltip cannot contain controls or require scrolling. */
export function QuestionHoverSummary({
  question,
  final,
}: {
  question: DraftQuestion;
  final: boolean;
}) {
  const { t } = useTranslation();
  const mediaCount = question.questionFiles.length + question.answerFiles.length;
  return (
    <div className="flex flex-col gap-3">
      {!final && (
        <span className="font-display text-xl font-extrabold text-accent">
          {question.price ?? "—"}
        </span>
      )}
      {(question.text || !question.questionFiles.length) && (
        <p className="m-0 line-clamp-3 [overflow-wrap:anywhere]">
          {question.text || t("editor.preview.noQuestion")}
        </p>
      )}
      {mediaCount > 0 && (
        <p className="m-0 text-sm text-muted">
          {t("editor.preview.mediaCount", { count: mediaCount })}
        </p>
      )}
      <div className="flex flex-col gap-1 rounded-sm bg-success-surface p-3">
        <span className="text-xs font-bold uppercase text-success">
          {t("editor.preview.answer")}
        </span>
        <span className="line-clamp-3 [overflow-wrap:anywhere]">
          {question.answerText ||
            t(question.answerFiles.length ? "editor.preview.mediaOnly" : "editor.preview.noAnswer")}
        </span>
      </div>
      <p className="m-0 text-xs text-muted">{t("editor.preview.openFull")}</p>
    </div>
  );
}

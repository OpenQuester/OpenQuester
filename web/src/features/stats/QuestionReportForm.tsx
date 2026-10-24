import { statsStyles } from "./statsStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { inputClass, Label } from "@/ui/Field";
import { REPORT_REASONS } from "./useStats";
import { useQuestionReportForm } from "./useQuestionReportForm";

export function QuestionReportForm({ gameId, questionId }: { gameId: string; questionId: number }) {
  const { t } = useTranslation();
  const { close, report, reason, setReason, comment, setComment, already, onSubmit } =
    useQuestionReportForm(gameId, questionId);

  return (
    <form className={layoutStyles.cardBody} onSubmit={onSubmit}>
      <fieldset className={layoutStyles.optionGroup}>
        <legend className="mb-2 font-semibold">{t("report.reason")}</legend>
        {REPORT_REASONS.map((r) => (
          <label
            key={r}
            className={cn(
              statsStyles.reportReason,
              reason === r ? "border-accent-line bg-accent-surface" : "border-line",
            )}
          >
            <input
              type="radio"
              name="report-reason"
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
            />
            {t(`report.reasons.${r}`)}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-comment">{t("report.comment")}</Label>
        <textarea
          id="report-comment"
          rows={3}
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("report.commentPlaceholder")}
          className={cn(inputClass, "resize-y py-3")}
        />
      </div>
      {report.isError && (
        <p role="alert" className="m-0 text-sm text-danger">
          {already ? t("report.already") : t("report.failed")}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="submit" variant="accent" size="lg" disabled={report.isPending}>
          {t("report.send")}
        </Button>
        <Button size="lg" variant="ghost" onClick={close}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

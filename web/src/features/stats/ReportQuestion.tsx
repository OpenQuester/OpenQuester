import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@/api/client";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { inputClass, Label } from "@/ui/Field";

import { REPORT_REASONS, type QuestionReportReason, useReportQuestion } from "./useStats";

/** "Report question" link and dialog: the note goes to the package's author. */
export function ReportQuestion({ gameId, questionId }: { gameId: string; questionId: number }) {
  const { t } = useTranslation();
  const report = useReportQuestion(gameId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<QuestionReportReason>("wrong_answer");
  const [comment, setComment] = useState("");
  // Remembered per question, so the link turns into "Reported" after sending
  const [sentFor, setSentFor] = useState<number | null>(null);
  const sent = sentFor === questionId;
  const already = report.error instanceof ApiError && report.error.status === 409;

  if (sent) {
    return (
      <p className="m-0 text-sm text-muted" data-testid="report-sent">
        {t("report.sent")}
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        className="text-sm text-muted underline-offset-2 hover:text-text hover:underline"
        onClick={() => {
          report.reset();
          setOpen(true);
        }}
        data-testid="report-question"
      >
        {t("report.open")}
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("report.title")}
        description={t("report.help")}
        closeLabel={t("common.close")}
      >
        <form
          className="flex flex-col gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            report.mutate(
              { questionId, reason, comment: comment.trim() || undefined },
              {
                onSuccess: () => {
                  setSentFor(questionId);
                  setComment("");
                  setOpen(false);
                },
              },
            );
          }}
        >
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 font-semibold">{t("report.reason")}</legend>
            {REPORT_REASONS.map((r) => (
              <label
                key={r}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3",
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
            <Button size="lg" variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

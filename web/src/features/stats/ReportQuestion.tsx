import { useState } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";

import { ApiError } from "@/api/client";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { inputClass, Label } from "@/ui/Field";

import { REPORT_REASONS, type QuestionReportReason, useReportQuestion } from "./useStats";

/**
 * Which question the report dialog is open for. It lives outside the answer
 * reveal: the reveal ends while someone is still typing, and the dialog must
 * stay open with it.
 */
const useReportStore = create<{
  questionId: number | null;
  sent: number[];
  open: (questionId: number) => void;
  close: () => void;
  markSent: (questionId: number) => void;
}>((set) => ({
  questionId: null,
  sent: [],
  open: (questionId) => set({ questionId }),
  close: () => set({ questionId: null }),
  markSent: (questionId) => set((s) => ({ sent: [...s.sent, questionId], questionId: null })),
}));

/** "Report question" link under the answer reveal; turns into "Reported" once sent. */
export function ReportQuestion({ questionId }: { questionId: number }) {
  const { t } = useTranslation();
  const sent = useReportStore((s) => s.sent.includes(questionId));
  const open = useReportStore((s) => s.open);

  if (sent) {
    return (
      <p className="m-0 text-sm text-muted" data-testid="report-sent">
        {t("report.sent")}
      </p>
    );
  }
  return (
    <button
      type="button"
      className="text-sm text-muted underline-offset-2 hover:text-text hover:underline"
      onClick={() => open(questionId)}
      data-testid="report-question"
    >
      {t("report.open")}
    </button>
  );
}

/** The report form; mounted once per game screen so it outlives the reveal. */
export function ReportQuestionDialog({ gameId }: { gameId: string }) {
  const { t } = useTranslation();
  const questionId = useReportStore((s) => s.questionId);
  const close = useReportStore((s) => s.close);
  return (
    <Dialog
      open={questionId != null}
      onOpenChange={(o) => !o && close()}
      title={t("report.title")}
      description={t("report.help")}
      closeLabel={t("common.close")}
    >
      {/* Keyed by question: every report starts with a fresh form */}
      {questionId != null && (
        <ReportForm key={questionId} gameId={gameId} questionId={questionId} />
      )}
    </Dialog>
  );
}

function ReportForm({ gameId, questionId }: { gameId: string; questionId: number }) {
  const { t } = useTranslation();
  const close = useReportStore((s) => s.close);
  const markSent = useReportStore((s) => s.markSent);
  const report = useReportQuestion(gameId);
  const [reason, setReason] = useState<QuestionReportReason>("wrong_answer");
  const [comment, setComment] = useState("");
  const already = report.error instanceof ApiError && report.error.status === 409;

  return (
    <form
      className="flex flex-col gap-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        report.mutate(
          { questionId, reason, comment: comment.trim() || undefined },
          { onSuccess: () => markSent(questionId) },
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
        <Button size="lg" variant="ghost" onClick={close}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

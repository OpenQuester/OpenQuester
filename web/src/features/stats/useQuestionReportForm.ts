import { useState, type FormEvent } from "react";
import { useGame } from "@/features/game/GameContext";
import { ApiError } from "@/api/client";
import { useReportStore } from "./questionReportStore";
import { type QuestionReportReason, useReportQuestion } from "./useStats";

export function useQuestionReportForm(gameId: string, questionId: number) {
  const { myId } = useGame();
  const close = useReportStore((s) => s.close);
  const markSent = useReportStore((s) => s.markSent);
  const report = useReportQuestion(gameId);
  const [reason, setReason] = useState<QuestionReportReason>("wrong_answer");
  const [comment, setComment] = useState("");
  const already = report.error instanceof ApiError && report.error.status === 409;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    report.mutate(
      { questionId, reason, comment: comment.trim() || undefined },
      { onSuccess: () => markSent(`${gameId}:${myId}`, questionId) },
    );
  }
  return { close, report, reason, setReason, comment, setComment, already, onSubmit };
}

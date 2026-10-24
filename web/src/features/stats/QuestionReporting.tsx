import { statsStyles } from "./statsStyles";
import { useTranslation } from "react-i18next";
import { Dialog } from "@/ui/Dialog";
import { QuestionReportForm } from "./QuestionReportForm";
import { useReportStore } from "./questionReportStore";
import { useGame, useSession } from "@/features/game/GameContext";

/** "Report question" link under the answer reveal; turns into "Reported" once sent. */
export function ReportQuestionButton({ questionId }: { questionId: number }) {
  const { t } = useTranslation();
  const { myId } = useGame();
  const { gameId } = useSession();
  const scope = `${gameId}:${myId}`;
  const sent = useReportStore((s) => s.sent.includes(`${scope}:${questionId}`));
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
      className={statsStyles.reportLink}
      onClick={() => open(scope, questionId)}
      data-testid="report-question"
    >
      {t("report.open")}
    </button>
  );
}

/** The report form; mounted once per game screen so it outlives the reveal. */
export function ReportQuestionDialog({ gameId }: { gameId: string }) {
  const { t } = useTranslation();
  const { myId } = useGame();
  const scope = `${gameId}:${myId}`;
  const questionId = useReportStore((s) => (s.scope === scope ? s.questionId : null));
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
        <QuestionReportForm
          key={`${scope}:${questionId}`}
          gameId={gameId}
          questionId={questionId}
        />
      )}
    </Dialog>
  );
}

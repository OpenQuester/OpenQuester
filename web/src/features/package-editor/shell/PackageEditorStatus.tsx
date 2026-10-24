import { packageEditorShellStyles } from "./packageEditorShellStyles";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { CheckIcon, UndoIcon } from "@/ui/icons";
import { countQuestions } from "../packageDraft";
import { usePackageEditor } from "../packageEditorStore";
import type { PackageValidationReport } from "../validatePackage";

export function PackageValidationStatus({
  report,
  onReview,
}: {
  report: PackageValidationReport;
  onReview: () => void;
}) {
  const { t } = useTranslation();
  const questions = usePackageEditor((s) => countQuestions(s.pkg));
  const first = report.issues.find((i) => i.severity !== "info");
  return (
    <footer className={packageEditorShellStyles.status}>
      <span
        aria-hidden
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          report.health === "broken"
            ? "bg-danger-strong"
            : report.health === "needsAttention"
              ? "bg-warning"
              : "bg-success",
        )}
      />
      <span className="min-w-0 flex-1 truncate text-soft" data-testid="health">
        {report.health === "good"
          ? t("editor.status.good", { count: questions })
          : first
            ? `${t(`editor.health.${report.health}`, { count: report.critical })} · ${t(`editor.issues.${first.code}`, first.args)}`
            : ""}
      </span>
      {report.health !== "good" && (
        <button
          type="button"
          onClick={onReview}
          className="shrink-0 font-semibold text-info-soft hover:text-text"
        >
          {t("editor.status.review")}
        </button>
      )}
    </footer>
  );
}

export function PackageUndoToast() {
  const { t } = useTranslation();
  const change = usePackageEditor((s) => s.lastChange);
  const undo = usePackageEditor((s) => s.undo);
  const [hidden, setHidden] = useState<number | null>(null);
  useEffect(() => {
    if (!change) return;
    const id = window.setTimeout(() => setHidden(change.at), 6000);
    return () => window.clearTimeout(id);
  }, [change]);
  const quiet =
    !change || hidden === change.at || change.key === "renamed" || change.key === "questionSaved";
  if (quiet) return null;
  return (
    <div className={packageEditorShellStyles.toastPosition} aria-live="polite">
      <div className={packageEditorShellStyles.toast} role="status">
        <CheckIcon size={16} />
        <span className="text-sm [overflow-wrap:anywhere]">
          {t(`editor.changes.${change.key}`, change.args)}
        </span>
        <Button size="sm" variant="ghost" onClick={undo} icon={<UndoIcon size={16} />}>
          {t("editor.undo")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Autosave failed (device storage full, or the write was aborted): the edits
 * only live in this tab. Offers a retry and a file export so nothing is lost.
 */
export function DraftSaveFailure({ onExport }: { onExport: () => void }) {
  const { t } = useTranslation();
  const saveError = usePackageEditor((s) => s.saveError);
  const retrySave = usePackageEditor((s) => s.retrySave);

  if (!saveError) return null;

  return (
    <div role="alert" className={packageEditorShellStyles.saveFailure} data-testid="save-failed">
      <span className="min-w-0 flex-1 text-sm">{t("editor.saveFailed")}</span>
      <Button size="sm" onClick={retrySave}>
        {t("editor.saveRetry")}
      </Button>
      <Button size="sm" variant="ghost" onClick={onExport}>
        {t("editor.export")}
      </Button>
    </div>
  );
}

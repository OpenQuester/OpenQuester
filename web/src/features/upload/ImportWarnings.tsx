import { layoutStyles } from "@/ui/layoutStyles";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";

import type { ImportWarning } from "./types";

const SHOWN_WARNINGS = 6;

/** What an imported file had to change or leave out (SIQ types, missing media, …). */
export function ImportWarnings({
  warnings,
  onDismiss,
}: {
  warnings: ImportWarning[];
  /** Shown as "Hide" in the editor, where the report stays until dismissed. */
  onDismiss?: () => void;
}) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const shown = all ? warnings : warnings.slice(0, SHOWN_WARNINGS);
  return (
    <Card tone="raised" data-testid="upload-warnings">
      <div className="flex flex-col gap-3">
        <p className="m-0 font-semibold text-warning">
          {t("upload.warningsTitle", { count: warnings.length })}
        </p>
        <p className="m-0 text-sm text-soft">{t("upload.warningsHelp")}</p>
        <ul className={layoutStyles.list}>
          {shown.map((w, i) => (
            <li key={i} className="text-sm [overflow-wrap:anywhere]">
              {w.where && <span className="text-muted">{w.where} · </span>}
              {t(`upload.warnings.${w.code}`, { detail: w.detail ?? "" })}
            </li>
          ))}
        </ul>
        {onDismiss && (
          <Button size="sm" variant="ghost" className="self-start" onClick={onDismiss}>
            {t("editor.importReportHide")}
          </Button>
        )}
        {warnings.length > SHOWN_WARNINGS && (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => setAll((v) => !v)}
          >
            {all ? t("upload.showFewer") : t("upload.showAll", { count: warnings.length })}
          </Button>
        )}
      </div>
    </Card>
  );
}

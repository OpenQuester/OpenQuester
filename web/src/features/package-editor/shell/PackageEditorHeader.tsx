import { layoutStyles } from "@/ui/layoutStyles";
import { packageEditorShellStyles } from "./packageEditorShellStyles";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { timeAgo } from "@/lib/format";
import { Button } from "@/ui/Button";
import {
  BackIcon,
  DownloadIcon,
  EditIcon,
  RedoIcon,
  SaveIcon,
  SearchIcon,
  UndoIcon,
  UploadIcon,
} from "@/ui/icons";
import { InlineText } from "../InlineText";
import { usePackageEditor } from "../packageEditorStore";
import type { PackageValidationReport } from "../validatePackage";
import { QuestionDensityToggle, PackageEditorIconButton } from "./PackageEditorControls";

export function PackageEditorHeader({
  onPublish,
  onDetails,
  onExport,
  onSearch,
  report,
  mediaBytes,
}: {
  onPublish: () => void;
  onDetails: () => void;
  onExport: () => void;
  onSearch: () => void;
  report: PackageValidationReport;
  mediaBytes: number;
}) {
  const { t } = useTranslation();
  const title = usePackageEditor((s) => s.pkg.title);
  const apply = usePackageEditor((s) => s.apply);
  const canUndo = usePackageEditor((s) => s.past.length > 0);
  const canRedo = usePackageEditor((s) => s.future.length > 0);
  const undo = usePackageEditor((s) => s.undo);
  const redo = usePackageEditor((s) => s.redo);
  const savedAt = usePackageEditor((s) => s.savedAt);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className={packageEditorShellStyles.header}>
      <Link
        to="/packages/editor"
        aria-label={t("editor.backToDrafts")}
        className={packageEditorShellStyles.backLink}
      >
        <BackIcon size={18} />
        <span className="hidden sm:inline">{t("editor.drafts")}</span>
      </Link>
      <div className={layoutStyles.wrappingField}>
        <InlineText
          label={t("editor.details.name")}
          value={title}
          onCommit={(v) => apply((p) => ({ ...p, title: v }), { key: "renamed" })}
          placeholder={t("editor.details.namePlaceholder")}
          className="font-display text-xl font-extrabold"
        />
        <span className={packageEditorShellStyles.packageSubtitle} data-testid="save-status">
          <SaveIcon size={14} />
          {savedAt
            ? t("editor.savedAt", { when: timeAgo(new Date(savedAt).toISOString()) })
            : t("editor.notSaved")}
          {mediaBytes > 0 && ` · ${formatMediaBytes(mediaBytes)}`}
        </span>
      </div>
      <div className={packageEditorShellStyles.historyActions}>
        <PackageEditorIconButton label={t("editor.outline.details")} onClick={onDetails}>
          <EditIcon size={18} />
        </PackageEditorIconButton>
        <PackageEditorIconButton label={t("editor.undo")} onClick={undo} disabled={!canUndo}>
          <UndoIcon size={18} />
        </PackageEditorIconButton>
        <PackageEditorIconButton label={t("editor.redo")} onClick={redo} disabled={!canRedo}>
          <RedoIcon size={18} />
        </PackageEditorIconButton>
        <QuestionDensityToggle />
        <PackageEditorIconButton label={t("editor.tools.searchTitle")} onClick={onSearch}>
          <SearchIcon size={18} />
        </PackageEditorIconButton>
        <div className={packageEditorShellStyles.publishActions}>
          <Button
            icon={<DownloadIcon size={18} />}
            onClick={onExport}
            title={t("editor.exportHelp")}
            aria-label={t("editor.export")}
            className="px-3 md:px-4"
          >
            <span className="hidden md:inline">{t("editor.export")}</span>
          </Button>
          <Button
            variant="accent"
            icon={<UploadIcon size={18} />}
            onClick={onPublish}
            data-testid="publish"
          >
            {t("editor.publish.open")}
            {report.critical > 0 && (
              <span className={packageEditorShellStyles.issueCount}>{report.critical}</span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}

function formatMediaBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

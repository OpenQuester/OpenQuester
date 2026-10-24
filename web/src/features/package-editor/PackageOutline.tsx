import { packageOutlineStyles } from "./outline/packageOutlineStyles";
import { useTranslation } from "react-i18next";
import { PlusIcon } from "@/ui/icons";
import { usePackageEditor } from "./packageEditorStore";
import type { PackageValidationReport } from "./validatePackage";
import { OutlineRoundItem } from "./outline/OutlineRoundItem";

/**
 * The package tree on wide screens. Every round and theme is a drop target, so
 * a question or theme can go anywhere in the package without scrolling the
 * board; resting on a round opens it.
 */
export function PackageOutline({
  report,
  onAddRound,
  onDetails,
  onJumpTheme,
}: {
  report: PackageValidationReport;
  onAddRound: () => void;
  onDetails: () => void;
  onJumpTheme: (roundId: string, themeId: string) => void;
}) {
  const { t } = useTranslation();
  const rounds = usePackageEditor((s) => s.pkg.rounds);
  const readOnly = usePackageEditor((s) => s.readOnly);
  return (
    <nav
      aria-label={t("editor.outline.label")}
      className="flex flex-col gap-1.5"
      data-testid="outline"
    >
      {!readOnly && (
        <button type="button" onClick={onDetails} className={packageOutlineStyles.details}>
          {t("editor.outline.details")}
        </button>
      )}
      <div className={packageOutlineStyles.heading}>{t("editor.outline.rounds")}</div>
      <ol className={packageOutlineStyles.rounds}>
        {rounds.map((r, i) => (
          <OutlineRoundItem
            key={r.id}
            round={r}
            index={i}
            report={report}
            onJumpTheme={onJumpTheme}
          />
        ))}
      </ol>
      {!readOnly && (
        <button type="button" onClick={onAddRound} className={packageOutlineStyles.addRound}>
          <PlusIcon size={16} />
          {t("editor.outline.addRound")}
        </button>
      )}
    </nav>
  );
}

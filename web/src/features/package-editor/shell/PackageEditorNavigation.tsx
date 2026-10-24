import { packageEditorShellStyles } from "./packageEditorShellStyles";
import { typographyStyles } from "@/ui/typographyStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { PlusIcon } from "@/ui/icons";
import { usePackageEditor } from "../packageEditorStore";

export function PackageRoundChips({ onAdd }: { onAdd?: () => void }) {
  const { t } = useTranslation();
  const rounds = usePackageEditor((s) => s.pkg.rounds);
  const roundId = usePackageEditor((s) => s.roundId);
  const selectRound = usePackageEditor((s) => s.selectRound);
  return (
    <nav aria-label={t("editor.outline.rounds")} className={packageEditorShellStyles.roundTabs}>
      {rounds.map((r, i) => (
        <button
          key={r.id}
          type="button"
          aria-current={r.id === roundId ? "page" : undefined}
          onClick={() => selectRound(r.id)}
          className={cn(
            packageEditorShellStyles.roundTab,
            r.id === roundId ? "bg-surface-3 text-text" : "border border-line-strong text-muted",
          )}
        >
          {i + 1} · {r.name || t("editor.outline.untitled")}
        </button>
      ))}
      {onAdd && (
        <button
          type="button"
          aria-label={t("editor.outline.addRound")}
          onClick={onAdd}
          className={packageEditorShellStyles.addRound}
        >
          <PlusIcon size={16} />
        </button>
      )}
    </nav>
  );
}

export function EmptyPackageNotice({ onAddRound }: { onAddRound: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={packageEditorShellStyles.emptyPackage}>
      <p className={typographyStyles.sectionTitle}>{t("editor.empty.title")}</p>
      <p className="m-0 max-w-[48ch] text-muted">{t("editor.empty.help")}</p>
      <Button
        variant="accent"
        size="lg"
        icon={<PlusIcon size={18} />}
        onClick={onAddRound}
        data-testid="add-round"
      >
        {t("editor.outline.addRound")}
      </Button>
    </div>
  );
}

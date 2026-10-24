import { packageEditorShellStyles } from "./packageEditorShellStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { CardsIcon, ListIcon } from "@/ui/icons";
import { usePackageEditor } from "../packageEditorStore";

export function PackageEditorIconButton({
  label,
  onClick,
  children,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        packageEditorShellStyles.iconButton,
        danger
          ? "border-danger/40 bg-danger-surface text-danger"
          : "border-line-strong text-text hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

/** Compact cards with hover previews, or preview cards with media and answers. */
export function QuestionDensityToggle() {
  const { t } = useTranslation();
  const density = usePackageEditor((s) => s.density);
  const setDensity = usePackageEditor((s) => s.setDensity);
  return (
    <div
      role="group"
      aria-label={t("editor.density.label")}
      className={packageEditorShellStyles.densityToggle}
    >
      <button
        type="button"
        aria-pressed={density === "compact"}
        title={t("editor.density.compact")}
        aria-label={t("editor.density.compact")}
        onClick={() => setDensity("compact")}
        className={cn(
          packageEditorShellStyles.densityOption,
          density === "compact" ? "bg-surface-3 text-text" : "text-muted",
        )}
      >
        <ListIcon size={18} />
      </button>
      <button
        type="button"
        aria-pressed={density === "cards"}
        title={t("editor.density.cards")}
        aria-label={t("editor.density.cards")}
        data-testid="density-cards"
        // On phones this is the only view button, so it toggles.
        onClick={() => setDensity(density === "cards" ? "compact" : "cards")}
        className={cn(
          packageEditorShellStyles.cardsDensityOption,
          density === "cards" ? "bg-surface-3 text-text" : "text-muted",
        )}
      >
        <CardsIcon size={18} />
      </button>
    </div>
  );
}

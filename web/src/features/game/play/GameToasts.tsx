import { gameScreenStyles } from "./screen/gameScreenStyles";
import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import { useGameStore } from "@/game/store";
import { CloseIcon } from "@/ui/icons";

export function GameToasts() {
  const { t } = useTranslation();
  const toasts = useGameStore((s) => s.toasts);
  const dismiss = useGameStore((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div className={gameScreenStyles.toasts} aria-live="assertive">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.kind === "error" ? "alert" : "status"}
          className={cn(
            gameScreenStyles.toast,
            toast.kind === "error" && "border-danger/50 bg-danger-surface text-on-danger-surface",
            toast.kind === "info" && "border-line-strong bg-surface-2 text-text",
            toast.kind === "success" && "border-success-line bg-success-surface text-success",
          )}
        >
          <span className="flex-1">{t(`errors.${toast.text}`, { defaultValue: toast.text })}</span>
          <button
            type="button"
            aria-label={t("common.dismiss")}
            onClick={() => dismiss(toast.id)}
            className={gameScreenStyles.dismissToast}
          >
            <CloseIcon size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

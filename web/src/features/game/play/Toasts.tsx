import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import { useGameStore } from "@/game/store";
import { CloseIcon } from "@/ui/icons";

export function Toasts() {
  const { t } = useTranslation();
  const toasts = useGameStore((s) => s.toasts);
  const dismiss = useGameStore((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4"
      aria-live="assertive"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.kind === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex max-w-[560px] items-center gap-3 rounded-md border px-4 py-3 shadow-xl oq-slide-up",
            toast.kind === "error" && "border-danger/50 bg-danger-surface text-[#FFD0CC]",
            toast.kind === "info" && "border-line-strong bg-surface-2 text-text",
            toast.kind === "success" && "border-success-line bg-success-surface text-success",
          )}
        >
          <span className="flex-1">{t(`errors.${toast.text}`, { defaultValue: toast.text })}</span>
          <button
            type="button"
            aria-label={t("common.dismiss")}
            onClick={() => dismiss(toast.id)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-current hover:bg-white/10"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/features/settings/settingsStore";
import { CloseIcon } from "@/ui/icons";
import "./HomeNotice.css";

export const HOME_NOTICE_LIFETIME = 30_000;
export const HOME_NOTICE_EXIT = 300;
export type HomeNoticeReason = "deleted" | "kicked" | "closed";

export function HomeNotice({
  reason,
  title,
  onDismiss,
}: {
  reason: HomeNoticeReason;
  title?: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);
  const reduced = useSettings((s) => s.reduceMotion);
  useEffect(() => {
    const timeout = window.setTimeout(() => setClosing(true), HOME_NOTICE_LIFETIME);
    return () => window.clearTimeout(timeout);
  }, []);
  useEffect(() => {
    if (!closing) return;
    const delay =
      reduced || window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : HOME_NOTICE_EXIT;
    const timeout = window.setTimeout(onDismiss, delay);
    return () => window.clearTimeout(timeout);
  }, [closing, onDismiss, reduced]);
  return (
    <div
      className="home-notice"
      data-closing={closing || undefined}
      data-testid="home-notice"
      style={{ "--notice-exit": HOME_NOTICE_EXIT + "ms" } as CSSProperties}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          role="status"
          className="flex items-center gap-3 rounded-md border border-warning/40 bg-warning-surface py-2 pl-5 pr-2 text-warning"
        >
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            {reason === "kicked" && title
              ? t("home.notice.kickedFrom", { title })
              : t(`home.notice.${reason}`)}
          </span>
          <button
            type="button"
            onClick={() => setClosing(true)}
            disabled={closing}
            aria-label={t("common.close")}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm hover:bg-warning/10"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

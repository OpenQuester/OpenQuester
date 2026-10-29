import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";

import { useMyStorage } from "./useStorage";

/** Show usage against the effective quota returned by the server. */
export function StorageMeter({ className }: { className?: string }) {
  const { t } = useTranslation();
  const storage = useMyStorage();
  if (storage.isLoading) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (!storage.data)
    return (
      <p role="alert" className="text-sm text-danger">
        {t("storage.loadFailed")}
      </p>
    );
  const { usedBytes, quotaBytes } = storage.data;
  const ratio = quotaBytes === null ? 0 : quotaBytes === 0 ? 1 : usedBytes / quotaBytes;
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid="storage-meter">
      <div className={layoutStyles.meterHeading}>
        <span className="font-semibold">{t("storage.title")}</span>
        <span className="text-sm text-soft">
          {quotaBytes === null
            ? t("storage.usedNoLimit", { used: formatBytes(usedBytes) })
            : t("storage.used", { used: formatBytes(usedBytes), quota: formatBytes(quotaBytes) })}
        </span>
      </div>
      {quotaBytes !== null && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t("storage.title")}
          className="h-2.5 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className={cn(
              "h-full rounded-full",
              ratio >= 0.75 ? "bg-danger" : ratio >= 0.5 ? "bg-warning" : "bg-success",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {quotaBytes !== null && ratio >= 0.8 && (
        <p className="m-0 text-sm text-muted">
          {ratio >= 1 ? t("storage.full") : t("storage.almostFull")}
        </p>
      )}
    </div>
  );
}

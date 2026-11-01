import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";

import { useMyStorage } from "./useStorage";
import "./StorageMeter.css";

/** Show usage against the effective quota returned by the server. */
export function StorageMeter({
  className,
  pendingBytes,
}: {
  className?: string;
  pendingBytes?: number;
}) {
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
  const { ratio, usedPct, pending, pendingPct, exceedsQuota, usageColor } = storageProjection(
    usedBytes,
    quotaBytes,
    pendingBytes,
  );
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
          aria-valuenow={Math.round(usedPct)}
          aria-label={t("storage.title")}
          aria-valuetext={
            pending > 0
              ? t("storage.projectedUsage", {
                  used: formatBytes(usedBytes),
                  pending: formatBytes(pending),
                })
              : undefined
          }
          className="flex h-2.5 overflow-hidden rounded-full bg-surface-2"
        >
          <div className={cn("h-full rounded-full", usageColor)} style={{ width: `${usedPct}%` }} />
          {pendingPct > 0 && (
            <div
              data-testid="storage-pending"
              className={cn(
                "storage-pending h-full rounded-r-full",
                exceedsQuota ? "bg-danger" : "bg-accent",
              )}
              style={{ width: `${pendingPct}%` }}
            />
          )}
        </div>
      )}
      {pending > 0 && (
        <p className={cn("m-0 text-sm", exceedsQuota ? "text-danger" : "text-soft")}>
          {t(exceedsQuota ? "storage.projectedOverQuota" : "storage.projected", {
            size: formatBytes(pending),
          })}
        </p>
      )}
      {quotaBytes !== null && ratio >= 0.8 && (
        <p className="m-0 text-sm text-muted">
          {ratio >= 1 ? t("storage.full") : t("storage.almostFull")}
        </p>
      )}
    </div>
  );
}

/** Keep predicted bytes separate from current usage, even when they exceed the quota. */
function storageProjection(used: number, quota: number | null, estimate = 0) {
  const ratio = quota === null ? 0 : quota === 0 ? 1 : used / quota;
  const usedPct = Math.max(0, Math.min(100, ratio * 100));
  const pending = Number.isFinite(estimate) ? Math.max(0, estimate) : 0;
  const pendingPct = quota && quota > 0 ? Math.min(100 - usedPct, (pending / quota) * 100) : 0;
  const exceedsQuota = quota !== null && pending > Math.max(0, quota - used);
  const usageColor = ratio >= 0.75 ? "bg-danger" : ratio >= 0.5 ? "bg-warning" : "bg-success";
  return { ratio, usedPct, pending, pendingPct, exceedsQuota, usageColor };
}

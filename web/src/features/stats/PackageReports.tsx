import { statsStyles } from "./statsStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Spinner } from "@/ui/Spinner";

import { PackageReportItem } from "./PackageReportItem";
import { usePackageReports, useResolveReport } from "./useStats";

/** Button with the open-report count; opens the list so the author can fix and resolve them. */
export function PackageReports({ packageId, title }: { packageId: number; title: string }) {
  const { t } = useTranslation();
  const reports = usePackageReports(packageId);
  const resolve = useResolveReport(packageId);
  const [open, setOpen] = useState(false);
  const count = reports.data?.open ?? 0;
  if (!reports.isError && !reports.data?.data.length) return null;

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        data-testid="package-reports"
        aria-label={t("reports.button", { n: count })}
      >
        {t("reports.short")}
        {count > 0 && <Badge tone="warning">{count}</Badge>}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("reports.title", { title })}
        description={t("reports.help")}
        closeLabel={t("common.close")}
        side="right"
      >
        <div className={statsStyles.reports}>
          {(reports.isError || resolve.isError) && (
            <p role="alert" className="m-0 text-sm text-danger">
              {(reports.error ?? resolve.error)?.message}
            </p>
          )}
          {reports.isError && (
            <Button onClick={() => void reports.refetch()}>{t("game.tryAgain")}</Button>
          )}
          {reports.isLoading ? (
            <Spinner label={t("common.loading")} />
          ) : (
            <ul className={layoutStyles.spacedList}>
              {reports.data?.data.map((r) => (
                <PackageReportItem
                  key={r.id}
                  report={r}
                  pending={resolve.isPending}
                  onResolve={() => resolve.mutate({ reportId: r.id, resolved: !r.resolved })}
                />
              ))}
            </ul>
          )}
        </div>
      </Dialog>
    </>
  );
}

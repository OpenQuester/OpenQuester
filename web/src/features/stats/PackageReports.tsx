import { useState } from "react";
import { useTranslation } from "react-i18next";

import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Spinner } from "@/ui/Spinner";

import { usePackageReports, useResolveReport } from "./useStats";

/** Button with the open-report count; opens the list so the author can fix and resolve them. */
export function PackageReports({ packageId, title }: { packageId: number; title: string }) {
  const { t } = useTranslation();
  const reports = usePackageReports(packageId);
  const resolve = useResolveReport(packageId);
  const [open, setOpen] = useState(false);
  const count = reports.data?.open ?? 0;
  if (!reports.data?.data.length) return null;

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
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-5">
          {reports.isLoading ? (
            <Spinner label={t("common.loading")} />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {reports.data.data.map((r) => (
                <li
                  key={r.id}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-md border border-line p-3",
                    r.resolved && "opacity-60",
                  )}
                  data-testid="package-report"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.resolved ? undefined : "warning"}>
                      {t(`report.reasons.${r.reason}`)}
                    </Badge>
                    <span className="text-xs text-muted">
                      {[r.reporter?.username, timeAgo(r.createdAt)].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <p className="m-0 line-clamp-3 text-sm [overflow-wrap:anywhere]">
                    {r.questionText || t("reports.noText")}
                  </p>
                  {r.comment && (
                    <p className="m-0 text-sm text-soft [overflow-wrap:anywhere]">“{r.comment}”</p>
                  )}
                  <Button
                    size="sm"
                    variant={r.resolved ? "ghost" : "primary"}
                    className="self-start"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ reportId: r.id, resolved: !r.resolved })}
                  >
                    {r.resolved ? t("reports.reopen") : t("reports.resolve")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>
    </>
  );
}

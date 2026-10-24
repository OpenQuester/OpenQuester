import { statsStyles } from "./statsStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/Button";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Badge } from "@/ui/Badge";
import type { QuestionReport } from "./useStats";

export function PackageReportItem({
  report,
  pending,
  onResolve,
}: {
  report: QuestionReport;
  pending: boolean;
  onResolve: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li
      className={cn(statsStyles.report, report.resolved && "opacity-60")}
      data-testid="package-report"
    >
      <div className={layoutStyles.actions}>
        <Badge tone={report.resolved ? undefined : "warning"}>
          {t(`report.reasons.${report.reason}`)}
        </Badge>
        <span className="text-xs text-muted">
          {[report.reporter?.username, timeAgo(report.createdAt)].filter(Boolean).join(" · ")}
        </span>
      </div>
      <p className={statsStyles.reportComment}>{report.questionText || t("reports.noText")}</p>
      {report.comment && <p className={statsStyles.reportQuestion}>“{report.comment}”</p>}
      <Button
        size="sm"
        variant={report.resolved ? "ghost" : "primary"}
        className="self-start"
        disabled={pending}
        onClick={onResolve}
      >
        {report.resolved ? t("reports.reopen") : t("reports.resolve")}
      </Button>
    </li>
  );
}

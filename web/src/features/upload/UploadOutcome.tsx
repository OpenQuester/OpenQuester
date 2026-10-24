import { uploadStyles } from "./uploadStyles";
import { linkStyles } from "@/ui/linkStyles";
import { typographyStyles } from "@/ui/typographyStyles";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { formatBytes } from "@/lib/format";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { CheckIcon } from "@/ui/icons";
import { UploadResultLinks } from "./UploadResultLinks";
import type { UploadStep } from "./usePackageUpload";

export function UploadPartial({
  step,
  onRetry,
}: {
  step: Extract<UploadStep, { kind: "partial" }>;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card data-testid="upload-partial">
      <div className="flex flex-col gap-4">
        <p role="alert" className="m-0 font-semibold text-warning">
          {step.state
            ? t("upload.unfinished", {
                uploaded: step.state.uploadedFiles,
                total: step.state.totalFiles,
              })
            : t("upload.partial", { count: step.failed.length })}
        </p>
        <p className="m-0 text-soft">{t("upload.unfinishedHelp")}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="accent" size="lg" onClick={onRetry}>
            {t("upload.retryFiles")}
          </Button>
          <Link to="/packages/mine" className={linkStyles.largeOutline}>
            {t("upload.resumeLater")}
          </Link>
        </div>
      </div>
    </Card>
  );
}
export function UploadDone({
  step,
  onReset,
}: {
  step: Extract<UploadStep, { kind: "done" }>;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card tone="accent" data-testid="upload-done">
      <div className="flex flex-col gap-4">
        <p className={typographyStyles.sectionTitleWithIcon}>
          <CheckIcon size={26} />
          {t("upload.done")}
        </p>
        <p className="m-0 text-soft [overflow-wrap:anywhere]">
          {t("upload.doneHelp", { title: step.title })}
        </p>
        {step.savings && step.savings.after < step.savings.before && (
          <p className="m-0 text-sm text-muted" data-testid="upload-savings">
            {t("upload.compress.saved", {
              before: formatBytes(step.savings.before),
              after: formatBytes(step.savings.after),
            })}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <UploadResultLinks id={step.id} />
          <Button size="lg" variant="ghost" onClick={onReset}>
            {t("upload.another")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
export function UploadFailed({
  step,
  onRetry,
  onReset,
}: {
  step: Extract<UploadStep, { kind: "failed" }>;
  onRetry: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card data-testid="upload-failed">
      <div className="flex flex-col gap-4">
        <p role="alert" className={uploadStyles.failureMessage}>
          {step.error}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="accent" size="lg" onClick={onRetry}>
            {t("upload.tryAgain")}
          </Button>
          <Button size="lg" onClick={onReset}>
            {t("upload.another")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

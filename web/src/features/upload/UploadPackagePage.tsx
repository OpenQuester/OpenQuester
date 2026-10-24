import { useTranslation } from "react-i18next";
import { Card } from "@/ui/Card";
import { Spinner } from "@/ui/Spinner";
import { PackageImportDropZone } from "./PackageImportDropZone";
import { UploadAccess } from "./UploadAccess";
import { UploadPageLayout } from "./UploadPageLayout";
import { UploadReview } from "./UploadReview";
import { UploadProgressCard } from "./UploadProgressCard";
import { UploadPartial, UploadDone, UploadFailed } from "./UploadOutcome";
import { usePackageUpload } from "./usePackageUpload";

export function UploadPackagePage() {
  const { t } = useTranslation();
  const { step, pick, upload, resume, edit, retry, reset } = usePackageUpload();
  return (
    <UploadPageLayout
      title={t("upload.title")}
      backTo="/packages"
      backLabel={t("upload.back")}
      description={<p className="m-0 text-soft">{t("upload.lead")}</p>}
    >
      <UploadAccess>
        {step.kind === "pick" ? (
          <PackageImportDropZone onFile={(f) => void pick(f)} error={step.error} />
        ) : step.kind === "reading" ? (
          <Card>
            <Spinner label={t("upload.reading", { name: step.name })} />
          </Card>
        ) : step.kind === "review" ? (
          <UploadReview
            parsed={step.parsed}
            name={step.name}
            onUpload={() => void upload(step.parsed, step.name)}
            onResume={(id) => void resume(step.parsed, step.name, id)}
            onEdit={() => void edit(step.parsed, step.name)}
            editing={step.editing}
            error={step.error}
            onCancel={reset}
          />
        ) : step.kind === "uploading" ? (
          <UploadProgressCard title={step.parsed.content.title} progress={step.progress} />
        ) : step.kind === "partial" ? (
          <UploadPartial
            step={step}
            onRetry={() => void retry(step.parsed, step.id, step.failed)}
          />
        ) : step.kind === "done" ? (
          <UploadDone step={step} onReset={reset} />
        ) : (
          <UploadFailed
            step={step}
            onRetry={() => void upload(step.parsed, step.name)}
            onReset={reset}
          />
        )}
      </UploadAccess>
    </UploadPageLayout>
  );
}

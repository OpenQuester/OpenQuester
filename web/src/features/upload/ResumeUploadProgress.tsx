import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { UploadIcon } from "@/ui/icons";
import { MediaCompressionToggle } from "./MediaCompressionToggle";
import { PackageImportDropZone } from "./PackageImportDropZone";
import type { UploadState } from "./upload";

export function ResumeUploadProgress({
  state: s,
  stashed,
  error,
  onFile,
  onUploadStashed,
}: {
  state: UploadState;
  stashed: number;
  error?: string;
  onFile: (file: File) => void;
  onUploadStashed: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5" data-testid="resume-pending">
      <Card>
        <div className="flex flex-col gap-3">
          <p className="m-0 text-lg font-semibold" data-testid="resume-summary">
            {t("upload.unfinished", { uploaded: s.uploadedFiles, total: s.totalFiles })}
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={s.totalFiles}
            aria-valuenow={s.uploadedFiles}
            aria-label={t("upload.progressLabel")}
            className="h-3 overflow-hidden rounded-full bg-surface-2"
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${(100 * s.uploadedFiles) / Math.max(1, s.totalFiles)}%` }}
            />
          </div>
          <p className="m-0 text-soft">{t("upload.unfinishedHelp")}</p>
        </div>
      </Card>
      {error && (
        <p role="alert" className="m-0 text-danger [overflow-wrap:anywhere]">
          {error}
        </p>
      )}
      {stashed > 0 && (
        <Card tone="raised" data-testid="resume-stash">
          <div className="flex flex-col gap-3">
            <p className="m-0 text-soft">
              {stashed === s.missing.length
                ? t("resume.stashAll", { count: stashed })
                : t("resume.stashSome", { count: stashed, total: s.missing.length })}
            </p>
            <Button
              variant="accent"
              size="lg"
              className="sm:self-start"
              icon={<UploadIcon size={20} />}
              onClick={onUploadStashed}
            >
              {t("resume.uploadStashed", { count: stashed })}
            </Button>
          </div>
        </Card>
      )}
      {stashed < s.missing.length && (
        <div className="flex flex-col gap-3" data-testid="resume-pick">
          <p className="m-0 text-soft">{t("resume.pickHelp")}</p>
          <PackageImportDropZone onFile={onFile} />
          <MediaCompressionToggle />
        </div>
      )}
    </div>
  );
}

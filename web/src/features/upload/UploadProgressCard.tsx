import { useTranslation } from "react-i18next";
import { formatBytes } from "@/lib/format";
import { Card } from "@/ui/Card";
import type { UploadProgress } from "./upload";
import { compressLabel } from "./progress";
import { UploadFileList } from "./UploadFileList";
import { UploadProgressBar } from "./UploadProgressBar";

/** Overall bar plus a row per media file with its own progress. */
export function UploadProgressCard({
  title,
  progress,
}: {
  title: string;
  progress: UploadProgress;
}) {
  const { t } = useTranslation();
  const o = progress.optimize;
  return (
    <Card data-testid="upload-progress">
      <div className="flex flex-col gap-4">
        <p className="m-0 font-semibold [overflow-wrap:anywhere]">{title}</p>
        <UploadProgressBar progress={progress} />
        <p className="m-0 text-sm text-soft" aria-live="polite">
          {o
            ? compressLabel(o, t)
            : progress.phase === "optimizing"
              ? t("common.loading")
              : progress.phase === "creating"
                ? t("upload.creating")
                : progress.phase === "checking" || progress.phase === "done"
                  ? t("upload.checking")
                  : t("upload.sending", {
                      done: progress.done,
                      total: progress.total,
                      sent: formatBytes(progress.sentBytes),
                      size: formatBytes(progress.totalBytes),
                    })}
        </p>
        {progress.files.length > 0 && <UploadFileList files={progress.files} />}
        <p className="m-0 text-sm text-muted">{t("upload.keepOpen")}</p>
      </div>
    </Card>
  );
}

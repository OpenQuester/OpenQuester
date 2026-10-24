import { uploadStyles } from "./uploadStyles";
import { useTranslation } from "react-i18next";
import type { UploadProgress } from "./upload";
import { uploadRatio } from "./progress";

export function UploadProgressBar({ progress }: { progress: UploadProgress }) {
  const { t } = useTranslation();
  const pct = Math.round(Math.min(1, uploadRatio(progress)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={t("upload.progressLabel")}
      className="h-3 overflow-hidden rounded-full bg-surface-2"
    >
      <div className={uploadStyles.progressFill} style={{ width: `${pct}%` }} />
    </div>
  );
}

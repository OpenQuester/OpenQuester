import { packagePublishStyles } from "./packagePublishStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { typographyStyles } from "@/ui/typographyStyles";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { compressLabel } from "@/features/upload/progress";
import { UploadFileList } from "@/features/upload/UploadFileList";
import { UploadProgressBar } from "@/features/upload/UploadProgressBar";
import type { UploadProgress } from "@/features/upload/upload";
import { CheckIcon } from "@/ui/icons";
import type { PublishStep } from "./usePublishPackage";

const primaryLinkClass = packagePublishStyles.playLink;

export function PublishProgress({ progress: p }: { progress: UploadProgress }) {
  const { t } = useTranslation();
  const o = p.optimize;
  return (
    <div className={layoutStyles.cardBody} data-testid="publish-progress">
      <UploadProgressBar progress={p} />
      <p className="m-0 text-sm text-soft" aria-live="polite">
        {o
          ? compressLabel(o, t)
          : p.phase === "creating"
            ? t("upload.creating")
            : p.phase === "checking" || p.phase === "done"
              ? t("upload.checking")
              : t("editor.publish.sending", { done: p.done, total: p.total })}
      </p>
      {p.files.length > 0 && <UploadFileList files={p.files} />}
      <p className="m-0 text-sm text-muted">{t("upload.keepOpen")}</p>
    </div>
  );
}
export function PublishDone({ step }: { step: Extract<PublishStep, { kind: "done" }> }) {
  const { t } = useTranslation();
  return (
    <div className={layoutStyles.cardBody} data-testid="publish-done">
      <p className={typographyStyles.sectionTitleWithIcon}>
        <CheckIcon size={26} />
        {t("upload.done")}
      </p>
      {step.unfinished && (
        <p role="alert" className="m-0 text-warning">
          {step.failed > 0
            ? t("upload.partial", { count: step.failed })
            : t("packages.uploadUnfinished")}
        </p>
      )}
      <p className="m-0 text-soft">
        {step.unfinished ? t("upload.unfinishedHelp") : t("editor.publish.doneHelp")}
      </p>
      <div className="flex flex-wrap gap-3">
        {step.unfinished ? (
          <Link
            to="/packages/$packageId/upload"
            params={{ packageId: String(step.id) }}
            className={primaryLinkClass}
          >
            {t("packages.resumeUpload")}
          </Link>
        ) : (
          <Link to="/games/new" search={{ packageId: step.id }} className={primaryLinkClass}>
            {t("packages.host")}
          </Link>
        )}
        <Link to="/packages" search={{ id: step.id }} className={packagePublishStyles.packageLink}>
          {t("upload.viewPackage")}
        </Link>
      </div>
    </div>
  );
}

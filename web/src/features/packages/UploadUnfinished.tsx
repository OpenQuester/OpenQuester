import { packageBrowserStyles } from "./packageBrowserStyles";
import { typographyStyles } from "@/ui/typographyStyles";
import { linkStyles } from "@/ui/linkStyles";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { AlertIcon } from "@/ui/icons";

/**
 * Shown instead of "Host a game" while a package's media is still
 * uploading: why it can't be played, and for its author the way to finish.
 */
export function UploadUnfinished({
  packageId,
  isAuthor,
  className,
}: {
  packageId: number;
  isAuthor: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(packageBrowserStyles.unfinishedUpload, className)}
      data-testid="upload-unfinished"
    >
      <p className={typographyStyles.warningHeading}>
        <AlertIcon size={18} />
        {t("packages.uploadUnfinished")}
      </p>
      <p className="m-0 text-sm text-soft">
        {isAuthor ? t("packages.uploadUnfinishedAuthor") : t("packages.uploadUnfinishedHelp")}
      </p>
      {isAuthor && (
        <Link
          to="/packages/$packageId/upload"
          params={{ packageId: String(packageId) }}
          className={linkStyles.resume}
        >
          {t("packages.resumeUpload")}
        </Link>
      )}
    </div>
  );
}

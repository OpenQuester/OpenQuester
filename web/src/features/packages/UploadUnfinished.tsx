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
      className={cn("flex flex-col gap-2 rounded-[12px] bg-warning-surface p-4", className)}
      data-testid="upload-unfinished"
    >
      <p className="m-0 flex items-center gap-2 font-semibold text-warning">
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
          className="inline-flex min-h-11 items-center justify-center self-start rounded-[12px] bg-accent px-4 font-semibold text-on-accent no-underline hover:text-on-accent"
        >
          {t("packages.resumeUpload")}
        </Link>
      )}
    </div>
  );
}

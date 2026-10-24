import { linkStyles } from "@/ui/linkStyles";
import { packageBrowserStyles } from "./packageBrowserStyles";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/Button";
import { timeAgo } from "@/lib/format";
import { Badge } from "@/ui/Badge";
import { EditIcon } from "@/ui/icons";
import { PackageReports } from "@/features/stats/PackageReports";
import { useDeletePackage, useOpenInEditor } from "./packageActions";
import type { PackageCard } from "./usePackages";
import { PackageDeleteButtons } from "./PackageDeleteButtons";

const playLink = linkStyles.primary;

export function MyPackageRow({ pkg }: { pkg: PackageCard }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { opening, error, open } = useOpenInEditor();
  const del = useDeletePackage();
  const [confirm, setConfirm] = useState(false);
  const unfinished = pkg.uploadStatus === "uploading";

  return (
    <li className={packageBrowserStyles.authorPackage} data-testid="my-package">
      <div className={packageBrowserStyles.authorPackageSummary}>
        <button
          type="button"
          className={packageBrowserStyles.authorPackageTitle}
          onClick={() => void navigate({ to: "/packages", search: { id: pkg.id } })}
        >
          {pkg.title}
        </button>
        <span className="text-sm text-muted">
          {pkg.roundsCount != null &&
            `${t("packages.counts", { rounds: pkg.roundsCount, questions: pkg.questionsCount ?? 0 })} · `}
          {t("myPackages.published", { when: timeAgo(pkg.createdAt) })}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {pkg.language && <Badge>{pkg.language.toUpperCase()}</Badge>}
          {pkg.ageRestriction && pkg.ageRestriction !== "NONE" && (
            <Badge tone="warning">{pkg.ageRestriction.replace("A", "")}+</Badge>
          )}
          {unfinished && <Badge tone="warning">{t("packages.uploadUnfinished")}</Badge>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {unfinished ? (
          <Link
            to="/packages/$packageId/upload"
            params={{ packageId: String(pkg.id) }}
            className={playLink}
            data-testid="my-package-resume"
          >
            {t("packages.resumeUpload")}
          </Link>
        ) : (
          <Link to="/games/new" search={{ packageId: pkg.id }} className={playLink}>
            {t("myPackages.host")}
          </Link>
        )}
        <Button
          icon={<EditIcon size={18} />}
          disabled={opening}
          onClick={() => void open(pkg.id)}
          data-testid="my-package-edit"
        >
          {opening ? t("myPackages.opening") : t("myPackages.edit")}
        </Button>
        <PackageReports packageId={pkg.id} title={pkg.title} />
        <PackageDeleteButtons
          confirm={confirm}
          pending={del.isPending}
          onConfirmChange={setConfirm}
          onDelete={() => del.mutate(pkg.id)}
          deleteTestId="my-package-delete"
          confirmTestId="my-package-delete-confirm"
        />
      </div>
      {unfinished && (
        <p className="m-0 w-full text-sm text-muted">{t("packages.uploadUnfinishedAuthor")}</p>
      )}
      {confirm && <p className="m-0 w-full text-sm text-muted">{t("myPackages.deleteHelp")}</p>}
      {(error || del.isError) && (
        <p role="alert" className="m-0 w-full text-sm text-danger">
          {error ?? t("myPackages.deleteFailed")}
        </p>
      )}
    </li>
  );
}

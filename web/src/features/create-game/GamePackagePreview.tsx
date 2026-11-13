import { createGameStyles } from "./createGameStyles";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { summarizePackage } from "@/features/packages/packageSummary";
import { EyeIcon, BackIcon } from "@/ui/icons";
import { linkStyles } from "@/ui/linkStyles";
import { cn } from "@/lib/cn";
import { Spinner } from "@/ui/Spinner";
import type { CreateGameForm } from "./useCreateGame";

export function GamePackagePreview({
  packageId,
  pkg,
}: {
  packageId: number;
  pkg: CreateGameForm["pkg"];
}) {
  const { t } = useTranslation();
  return (
    <aside aria-label={t("create.package")} className={createGameStyles.packagePreview}>
      <span className={createGameStyles.previewLabel}>{t("create.package")}</span>
      {pkg.isLoading ? (
        <Spinner />
      ) : pkg.data ? (
        <>
          {pkg.data.logo?.file.link && (
            <img
              src={pkg.data.logo.file.link}
              alt=""
              className="size-14 rounded-sm object-contain"
            />
          )}
          <h2 className="m-0 text-xl font-semibold [overflow-wrap:anywhere]">{pkg.data.title}</h2>
          <span className="text-sm text-soft">
            {t("packages.counts", {
              rounds: pkg.data.rounds.length,
              questions: summarizePackage(pkg.data).questionCount,
            })}
          </span>
        </>
      ) : (
        <span role="alert" className="text-danger">
          {t("packages.loadFailed")}
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        <Link
          to="/packages/$packageId/preview"
          params={{ packageId: String(packageId) }}
          className={cn(linkStyles.secondary, "px-3 text-sm")}
          data-testid="create-preview"
        >
          <EyeIcon size={16} />
          {t("packages.preview")}
        </Link>
        <Link
          to="/packages"
          search={{ id: packageId }}
          className={cn(linkStyles.secondary, "px-3 text-sm")}
        >
          <BackIcon size={16} />
          {t("create.changePackage")}
        </Link>
      </div>
    </aside>
  );
}

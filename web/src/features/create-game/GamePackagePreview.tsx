import { createGameStyles } from "./createGameStyles";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { summarizePackage } from "@/features/packages/packageSummary";
import { EyeIcon } from "@/ui/icons";
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
          <span className="text-xl font-semibold [overflow-wrap:anywhere]">{pkg.data.title}</span>
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
      <Link
        to="/packages/$packageId/preview"
        params={{ packageId: String(packageId) }}
        className="inline-flex items-center gap-1.5 text-sm"
        data-testid="create-preview"
      >
        <EyeIcon size={16} />
        {t("packages.preview")}
      </Link>
      <Link to="/packages" search={{ id: packageId }} className="text-sm">
        {t("create.changePackage")}
      </Link>
    </aside>
  );
}

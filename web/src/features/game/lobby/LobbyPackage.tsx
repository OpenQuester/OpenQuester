import { useTranslation } from "react-i18next";
import { usePackage } from "@/features/packages/usePackages";
import { Button } from "@/ui/Button";
import { cn } from "@/lib/cn";
import { lobbyStyles } from "./lobbyStyles";
import { ChevronIcon } from "@/ui/icons";

/** Public round/theme names only; question content stays out of the lobby. */
export function LobbyPackage({ packageId, title }: { packageId?: number; title?: string }) {
  const { t } = useTranslation();
  const pkg = usePackage(packageId);
  return (
    <section aria-labelledby="package-h" className={cn(lobbyStyles.panel, "flex flex-col gap-4")}>
      <div className="flex items-center gap-3">
        {pkg.data?.logo?.file.link && (
          <img
            src={pkg.data.logo.file.link}
            alt=""
            className="size-12 shrink-0 rounded-sm object-contain"
          />
        )}
        <h2 id="package-h" className="m-0 min-w-0 text-xl font-semibold [overflow-wrap:anywhere]">
          {pkg.data?.title ?? title ?? t("create.package")}
        </h2>
      </div>
      {pkg.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-muted">
          {t("lobby.packageUnavailable")}
          <Button size="sm" onClick={() => void pkg.refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : !pkg.data ? (
        <p className="m-0 text-sm text-muted" role="status">
          {t("common.loading")}
        </p>
      ) : (
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-soft [&::-webkit-details-marker]:hidden">
            <span className="group-open:rotate-90">
              <ChevronIcon size={16} />
            </span>
            {t("lobby.packageOverview")}
          </summary>
          <ol className="mt-4 mb-0 flex list-none flex-col gap-4 p-0">
            {[...pkg.data.rounds]
              .sort((a, b) => a.order - b.order)
              .map((round) => (
                <li key={round.id} className="flex min-w-0 flex-col gap-2">
                  <h3
                    className={cn(
                      "m-0 text-base font-semibold [overflow-wrap:anywhere]",
                      round.type === "final" && "text-warning",
                    )}
                  >
                    {round.type === "final" && <span>{t("lobby.finalRound")} · </span>}
                    {round.name}
                  </h3>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {[...round.themes]
                      .sort((a, b) => a.order - b.order)
                      .map((theme) => (
                        <li
                          key={theme.id}
                          className="max-w-full rounded-sm bg-surface-2 px-3 py-1.5 text-sm text-soft [overflow-wrap:anywhere]"
                        >
                          {theme.name}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
          </ol>
        </details>
      )}
    </section>
  );
}

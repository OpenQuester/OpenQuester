import { homeStyles } from "./homeStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Spinner } from "@/ui/Spinner";
import { GameCard } from "./GameCard";
import type { HomeModel } from "./useHomePage";

export function OpenGames({
  games,
  visible,
  filter,
  setFilter,
}: Pick<HomeModel, "games" | "visible" | "filter" | "setFilter">) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-5" aria-labelledby="open-games">
      <div className="flex flex-wrap items-center gap-4">
        <h2 id="open-games" className={homeStyles.gamesTitle}>
          {t("home.openGames")}
        </h2>
        <div className="flex-1" />
        <div role="group" aria-label={t("home.filter")} className="flex flex-wrap gap-2">
          {(["all", "lobby", "playing"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                homeStyles.gameFilter,
                filter === f
                  ? "border-info bg-surface-3 text-text"
                  : "border-line-strong text-muted",
              )}
            >
              {t(`home.filters.${f}`)}
            </button>
          ))}
        </div>
      </div>
      {games.isLoading ? (
        <Spinner label={t("common.loading")} />
      ) : games.isError ? (
        <p role="alert" className="text-danger">
          {t("home.loadFailed")}
        </p>
      ) : visible.length === 0 ? (
        <div className={layoutStyles.emptyState}>{t("home.noGames")}</div>
      ) : (
        <ul className={homeStyles.games}>
          {visible.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </ul>
      )}
    </section>
  );
}

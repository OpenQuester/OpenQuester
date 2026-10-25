import { homeStyles } from "./homeStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { Label, TextInput } from "@/ui/Field";
import { Spinner } from "@/ui/Spinner";
import { GameCard } from "./GameCard";
import type { HomeModel } from "./useHomePage";

export function OpenGames({
  games,
  visible,
  filter,
  setFilter,
  search,
  changeSearch,
  isSearching,
  hasSearch,
}: Pick<
  HomeModel,
  | "games"
  | "visible"
  | "filter"
  | "setFilter"
  | "search"
  | "changeSearch"
  | "isSearching"
  | "hasSearch"
>) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="game-search">{t("home.search")}</Label>
        <div className="flex flex-wrap gap-2">
          <TextInput
            ref={input}
            id="game-search"
            type="search"
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
            maxLength={70}
            aria-describedby="game-search-help"
            className="flex-[1_1_240px] bg-surface"
          />
          <Button
            variant="ghost"
            disabled={!search}
            onClick={() => {
              changeSearch("");
              input.current?.focus();
            }}
          >
            {t("home.clearSearch")}
          </Button>
        </div>
        <p id="game-search-help" className="m-0 text-sm text-muted">
          {t("home.searchHelp")}
        </p>
      </div>
      <div aria-live="polite" aria-busy={isSearching || games.isFetching}>
        {isSearching || games.isLoading ? (
          <Spinner label={t("common.loading")} />
        ) : games.isError ? (
          <p role="alert" className="text-danger">
            {t("home.loadFailed")}
          </p>
        ) : visible.length === 0 ? (
          <div className={layoutStyles.emptyState}>
            {t(hasSearch || filter !== "all" ? "home.noMatches" : "home.noGames")}
          </div>
        ) : (
          <ul className={homeStyles.games}>
            {visible.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

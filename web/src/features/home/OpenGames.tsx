import { homeStyles } from "./homeStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { TextInput } from "@/ui/Field";
import { CloseIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";
import { GameCard } from "./GameCard";
import type { HomeModel } from "./useHomePage";

type OpenGamesProps = Pick<
  HomeModel,
  | "games"
  | "visible"
  | "filter"
  | "setFilter"
  | "search"
  | "changeSearch"
  | "onSearchSubmit"
  | "setSearchComposing"
  | "hasSearch"
>;

export function OpenGames({
  games,
  visible,
  filter,
  setFilter,
  search,
  changeSearch,
  onSearchSubmit,
  setSearchComposing,
  hasSearch,
}: OpenGamesProps) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="flex flex-col gap-4" aria-labelledby="open-games">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <h2 id="open-games" className={homeStyles.gamesTitle}>
          {t("home.openGames")}
        </h2>
        <div className="ml-auto flex w-full flex-col items-end gap-2 sm:w-auto">
          <form
            role="search"
            aria-label={t("home.search")}
            onSubmit={onSearchSubmit}
            className="w-full sm:w-94"
          >
            <div className="relative">
              <TextInput
                ref={input}
                id="game-search"
                type="search"
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
                onCompositionStart={() => setSearchComposing(true)}
                onCompositionEnd={() => setSearchComposing(false)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  const composing =
                    event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
                  if (composing) event.preventDefault();
                }}
                maxLength={70}
                placeholder={t("home.search")}
                aria-label={t("home.search")}
                className="min-h-11 bg-surface pr-11 [&::-webkit-search-cancel-button]:appearance-none"
              />
              {search !== "" && (
                <button
                  type="button"
                  aria-label={t("home.clearSearch")}
                  className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-info"
                  onClick={() => {
                    changeSearch("");
                    input.current?.focus();
                  }}
                >
                  <CloseIcon size={16} />
                </button>
              )}
            </div>
          </form>
          <div
            role="group"
            aria-label={t("home.filter")}
            className="flex flex-wrap justify-end gap-2"
          >
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
      </div>
      <div aria-live="polite" aria-busy={games.isFetching}>
        {games.isLoading ? (
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

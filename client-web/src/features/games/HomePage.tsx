import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Search,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  api,
  type GameListItem,
  isGameStarted,
  type PackageSummary,
  pageTotal,
  seatedPlayerCount,
  unwrapPage,
} from "../../shared/api/client";
import styles from "../../shared/ui/ui.module.css";

const PAGE_SIZE = 24;

export function HomePage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [page, setPage] = useState(0);
  const gamesQuery = useQuery({
    queryKey: ["games", page],
    queryFn: () => api.games({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const packagesQuery = useQuery({
    queryKey: ["packages", "fresh"],
    queryFn: () =>
      api.packages({
        limit: 3,
        offset: 0,
        sortBy: "created_at",
        order: "desc",
        status: "published",
      }),
    retry: false,
  });
  const serverGames = unwrapPage(gamesQuery.data);
  const total = pageTotal(gamesQuery.data);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // The games endpoint has no title filter, so this narrows the page in view.
  // The label says so rather than implying it searches every room.
  const games = serverGames.filter(
    (game) =>
      game.title.toLowerCase().includes(search.trim().toLowerCase()) &&
      (!openOnly || !isGameStarted(game)),
  );
  const packages = unwrapPage(packagesQuery.data);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>{t("home.eyebrow")}</p>
          <h1>{t("home.title")}</h1>
          <p className={styles.lede}>{t("home.subtitle")}</p>
        </div>
        <Link className={styles.primaryButton} to="/games/new">
          {t("home.newGame")}
          <ArrowRight size={16} />
        </Link>
      </header>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("home.search")}
            aria-label={t("home.search")}
          />
        </label>
        <div className={styles.segmented}>
          <button data-active={!openOnly} onClick={() => setOpenOnly(false)}>
            {t("home.all")}
          </button>
          <button data-active={openOnly} onClick={() => setOpenOnly(true)}>
            {t("home.open")}
          </button>
        </div>
      </div>
      {gamesQuery.isPending ? (
        <div className={styles.empty}>{t("common.loading")}</div>
      ) : gamesQuery.isError ? (
        <div className={styles.empty} role="alert">
          {t("common.loadFailed")}
          <button
            className={styles.textLink}
            onClick={() => void gamesQuery.refetch()}
          >
            {t("common.retry")}
          </button>
        </div>
      ) : games.length ? (
        <div className={styles.grid}>
          {games.map((game) => (
            <GameCard game={game} key={game.id} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>{t("home.empty")}</div>
      )}
      {!gamesQuery.isError && total > PAGE_SIZE ? (
        <nav className={styles.pagination} aria-label={t("home.pagination")}>
          <button
            className={styles.secondaryButton}
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft size={15} aria-hidden="true" /> {t("common.previous")}
          </button>
          <span>
            {t("packages.page", { current: page + 1, total: pageCount })}
          </span>
          <button
            className={styles.secondaryButton}
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            {t("common.next")} <ChevronRight size={15} aria-hidden="true" />
          </button>
        </nav>
      ) : null}
      <div className={styles.sectionHeader}>
        <h2>{t("home.fresh")}</h2>
        <Link className={styles.textLink} to="/packages">
          {t("home.viewAll")} →
        </Link>
      </div>
      {packagesQuery.isPending ? (
        <div className={styles.empty}>{t("common.loading")}</div>
      ) : packagesQuery.isError ? (
        <div className={styles.empty} role="alert">
          {t("common.loadFailed")}
        </div>
      ) : packages.length ? (
        <div className={styles.grid}>
          {packages.slice(0, 3).map((item) => (
            <PackageCard item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>{t("packages.empty")}</div>
      )}
    </div>
  );
}

function GameCard({ game }: { game: GameListItem }) {
  const { t } = useTranslation();
  const started = isGameStarted(game);
  const seated = seatedPlayerCount(game);
  const full = seated >= game.maxPlayers;
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <span
          className={styles.status}
          data-state={started ? "playing" : full ? "full" : "open"}
        >
          {started ? t("home.inGame") : t("home.lobby")}
        </span>
        {game.isPrivate ? (
          <span className={styles.badge}>
            <LockKeyhole size={11} aria-hidden="true" /> {t("common.private")}
          </span>
        ) : (
          <span className={styles.badge}>{t("common.public")}</span>
        )}
      </div>
      <h2>{game.title}</h2>
      <p>
        {t("home.hostedBy", { name: game.createdBy.username })}
        {game.package?.title ? ` · ${game.package.title}` : ""}
      </p>
      <footer className={styles.cardFooter}>
        <span>
          <UsersRound size={13} aria-hidden="true" /> {seated}/{game.maxPlayers}{" "}
          {t("game.players")}
        </span>
        <Link className={styles.textLink} to={`/j/${game.id}`}>
          {started ? t("game.watch") : t("game.join")} →
        </Link>
      </footer>
    </article>
  );
}

export function PackageCard({ item }: { item: PackageSummary }) {
  const { t } = useTranslation();
  const logo = item.logo?.file?.link;
  return (
    <Link to={`/packages/${item.id}`} className={styles.linkCard}>
      <div className={styles.cardTop}>
        <span className={styles.badge}>
          {(item.language ?? "en").toUpperCase()}
        </span>
        <span className={styles.badge}>
          {item.status === "draft"
            ? t("packages.draft")
            : t("packages.published")}
        </span>
      </div>
      {logo ? (
        <img className={styles.cardArt} src={logo} alt="" loading="lazy" />
      ) : null}
      <h3>{item.title}</h3>
      <p>{item.description ?? t("packages.noDescription")}</p>
      <footer className={styles.cardFooter}>
        <span>{t("packages.rounds", { count: item.roundsCount ?? 0 })}</span>
        <span>
          {t("packages.questions", { count: item.questionsCount ?? 0 })}
        </span>
      </footer>
    </Link>
  );
}

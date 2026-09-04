import { useQuery } from "@tanstack/react-query";
import { ArrowRight, LockKeyhole, Search, UsersRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  api,
  type GameListItem,
  type PackageSummary,
  unwrapPage,
} from "../../shared/api/client";
import styles from "../../shared/ui/ui.module.css";

export function HomePage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const gamesQuery = useQuery({
    queryKey: ["games"],
    queryFn: () => api.games(),
    retry: false,
  });
  const packagesQuery = useQuery({
    queryKey: ["packages", "fresh"],
    queryFn: () =>
      api.packages("limit=3&offset=0&sortBy=created_at&order=desc"),
    retry: false,
  });
  const serverGames = unwrapPage(gamesQuery.data);
  const games = serverGames.filter(
    (game) =>
      game.title.toLowerCase().includes(search.toLowerCase()) &&
      (!openOnly || !game.started),
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
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <span className={styles.status}>
          {game.started ? t("home.inGame") : t("home.lobby")}
        </span>
        {game.isPrivate ? (
          <span className={styles.badge}>
            <LockKeyhole size={11} /> {t("common.private")}
          </span>
        ) : (
          <span className={styles.badge}>{t("common.public")}</span>
        )}
      </div>
      <h2>{game.title}</h2>
      <p>{t("home.communityRoom")}</p>
      <footer className={styles.cardFooter}>
        <span>
          <UsersRound size={13} /> {game.playersCount ?? 0}/
          {game.maxPlayers ?? 8} {t("game.players")}
        </span>
        <Link className={styles.textLink} to={`/j/${game.id}`}>
          {game.started ? t("game.watch") : t("game.join")} →
        </Link>
      </footer>
    </article>
  );
}

export function PackageCard({ item }: { item: PackageSummary }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/packages/${item.id}`}
      className={styles.card}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div className={styles.cardTop}>
        <span className={styles.badge}>{item.language ?? "EN"}</span>
        <span className={styles.badge}>
          {item.status === "draft"
            ? t("packages.draft")
            : t("packages.published")}
        </span>
      </div>
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

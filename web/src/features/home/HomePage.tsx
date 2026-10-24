import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/app/AppShell";
import type { GameListItem } from "@/api/types";
import { useMe } from "@/features/auth/useMe";
import { timeAgo } from "@/lib/format";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { FieldError, TextInput } from "@/ui/Field";
import { LockIcon } from "@/ui/icons";
import { Spinner } from "@/ui/Spinner";

import { leftGames, rememberLeftGame } from "@/game/store";

import { gameStatus, parseGameCode, playerCount, useGames, type GameStatus } from "./useGames";

type Filter = "all" | "lobby" | "playing";

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notice } = useSearch({ from: "/shell/" });
  const me = useMe();
  const games = useGames();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [hidden, setHidden] = useState<string[]>(() => leftGames());

  const list = useMemo(
    () => (games.data ?? []).filter((g) => gameStatus(g) !== "finished"),
    [games.data],
  );
  // Games you are still seated in, except ones you left on purpose from this browser.
  const mine = me.data
    ? list.find((g) => !hidden.includes(g.id) && g.players.some((p) => p.id === me.data!.id))
    : undefined;
  const visible = list.filter((g) => filter === "all" || gameStatus(g) === filter);

  function onJoin(e: FormEvent) {
    e.preventDefault();
    const parsed = parseGameCode(code);
    if (!parsed) {
      setCodeError(t("home.codeInvalid"));
      return;
    }
    void navigate({ to: "/games/$gameId", params: { gameId: parsed } });
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-10">
        {(notice === "kicked" || notice === "deleted" || notice === "closed") && (
          <div
            role="status"
            className="rounded-md border border-line-strong bg-surface-2 px-5 py-4 text-soft"
          >
            {t(`home.notice.${notice}`)}
          </div>
        )}
        {mine && (
          <section
            aria-label={t("home.inProgress")}
            className="flex flex-wrap items-center gap-4 rounded-[18px] border border-accent-line bg-accent-surface px-5 py-4"
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent" />
            <div className="flex min-w-[220px] flex-1 flex-col">
              <span className="font-semibold">{t("home.stillIn", { title: mine.title })}</span>
              <span className="text-sm text-on-accent-surface">
                {gameStatus(mine) === "lobby" ? t("home.stillInLobby") : t("home.stillInPlaying")}
              </span>
            </div>
            <Link
              to="/games/$gameId"
              params={{ gameId: mine.id }}
              className="inline-flex min-h-11 items-center rounded-[12px] bg-accent px-5 font-semibold text-on-accent no-underline hover:text-on-accent"
            >
              {t("home.rejoin")}
            </Link>
            <Button
              variant="ghost"
              className="border-accent-line text-accent-soft"
              onClick={() => {
                rememberLeftGame(mine.id);
                setHidden(leftGames());
              }}
            >
              {t("home.hideRejoin")}
            </Button>
          </section>
        )}

        <section className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <div className="flex min-w-0 flex-col gap-5 rounded-lg border border-line bg-surface p-6 sm:p-8">
            <h1 className="m-0 font-display text-[clamp(32px,5vw,44px)] font-extrabold leading-[1.05] tracking-tight">
              {t("home.joinTitle")}
            </h1>
            <p className="m-0 max-w-[62ch] text-muted">{t("home.joinSubtitle")}</p>
            <form onSubmit={onJoin} className="flex flex-wrap gap-3" noValidate>
              <label htmlFor="game-code" className="sr-only">
                {t("home.codeLabel")}
              </label>
              <TextInput
                id="game-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeError(null);
                }}
                placeholder={t("home.codeLabel")}
                className="h-[52px] flex-[1_1_240px] font-mono text-[17px]"
                autoCapitalize="characters"
                aria-invalid={codeError ? true : undefined}
                aria-describedby={codeError ? "code-error" : undefined}
              />
              <Button type="submit" variant="accent" size="lg">
                {t("home.join")}
              </Button>
            </form>
            <FieldError id="code-error">{codeError}</FieldError>
          </div>
          <div className="flex min-w-0 flex-col justify-between gap-5 rounded-lg border border-line-strong bg-surface-2 p-6 sm:p-8">
            <div className="flex flex-col gap-2">
              <h2 className="m-0 font-display text-[clamp(26px,3vw,32px)] font-extrabold">
                {t("home.hostTitle")}
              </h2>
              <p className="m-0 max-w-[48ch] text-muted">{t("home.hostSubtitle")}</p>
            </div>
            <Link
              to="/packages"
              className="flex min-h-[52px] items-center justify-center rounded-md bg-primary text-[17px] font-semibold text-on-primary no-underline hover:text-on-primary"
            >
              {t("home.createGame")}
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-5" aria-labelledby="open-games">
          <div className="flex flex-wrap items-center gap-4">
            <h2 id="open-games" className="m-0 font-display text-[28px] font-extrabold">
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
                    "min-h-10 rounded-full border px-4 text-[15px] font-medium",
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
            <div className="rounded-lg border border-dashed border-line-strong p-8 text-center text-muted">
              {t("home.noGames")}
            </div>
          ) : (
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-4 p-0">
              {visible.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageContainer>
  );
}

function GameCard({ game }: { game: GameListItem }) {
  const { t } = useTranslation();
  const status: GameStatus = gameStatus(game);
  const full = playerCount(game) >= game.maxPlayers;
  const canPlay = !full && status !== "finished";
  return (
    <li
      className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-5"
      data-testid="game-card"
    >
      <div className="flex items-center gap-2">
        <Badge tone={status === "lobby" ? "success" : "accent"}>
          {status === "lobby" ? t("home.status.lobby") : t("home.status.playing")}
        </Badge>
        {game.isPrivate && (
          <Badge tone="neutral">
            <LockIcon size={14} /> {t("home.private")}
          </Badge>
        )}
        <span className="ml-auto text-[13px] text-muted">
          {timeAgo(game.startedAt ?? game.createdAt)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-[19px] font-semibold [overflow-wrap:anywhere]">{game.title}</h3>
        <p className="m-0 text-sm text-muted [overflow-wrap:anywhere]">
          {t("home.package", { title: game.package.title })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span>
          <span className="font-mono text-text">
            {playerCount(game)}/{game.maxPlayers}
          </span>{" "}
          {t("home.players")}
        </span>
        <span aria-hidden="true">·</span>
        <span>{t("home.host", { name: game.createdBy.username })}</span>
      </div>
      <Link
        to="/games/$gameId"
        params={{ gameId: game.id }}
        className="mt-auto flex min-h-11 items-center justify-center rounded-[12px] border border-line-strong font-semibold text-text no-underline hover:bg-surface-2 hover:text-text"
        aria-label={`${canPlay ? t("home.join") : t("home.watch")}: ${game.title}`}
      >
        {canPlay ? t("home.join") : t("home.watch")}
      </Link>
    </li>
  );
}

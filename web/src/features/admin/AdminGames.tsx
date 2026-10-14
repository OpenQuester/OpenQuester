import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { GameListItem } from "@/api/types";
import { gameStatus, playerCount } from "@/features/home/useGames";
import { formatScore, timeAgo } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/Field";
import { Spinner } from "@/ui/Spinner";

import {
  ADMIN_PAGE_SIZE,
  useAdminGame,
  useAdminGames,
  useGameAction,
  type AdminGamePlayer,
  type GameAction,
} from "./useAdmin";

/** Every game, private ones included, with live moderation of the one you open. */
export function AdminGames() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const games = useAdminGames(search, page, true);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(input);
      setPage(0);
    }, 250);
    return () => window.clearTimeout(id);
  }, [input]);

  const pages = Math.max(1, Math.ceil((games.data?.pageInfo.total ?? 0) / ADMIN_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5" data-testid="admin-games">
      <label htmlFor="adm-game-search" className="sr-only">
        {t("adminPanel.gameSearch")}
      </label>
      <TextInput
        id="adm-game-search"
        type="search"
        value={input}
        placeholder={t("adminPanel.gameSearch")}
        onChange={(e) => setInput(e.target.value)}
        className="bg-surface"
      />
      {games.isLoading ? (
        <Spinner label={t("common.loading")} />
      ) : games.isError ? (
        <p role="alert" className="text-danger">
          {t("adminPanel.loadFailed")}
        </p>
      ) : games.data?.data.length === 0 ? (
        <p className="m-0 text-muted">{t("adminPanel.noGames")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {games.data?.data.map((g) => (
            <GameRow
              key={g.id}
              game={g}
              open={open === g.id}
              onToggle={() => setOpen((x) => (x === g.id ? null : g.id))}
            />
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="flex items-center gap-3">
          <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            {t("packages.prev")}
          </Button>
          <span className="text-sm text-muted">
            {t("packages.page", { page: page + 1, pages })}
          </span>
          <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
            {t("packages.next")}
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ game, paused }: { game: GameListItem; paused?: boolean }) {
  const { t } = useTranslation();
  const status = gameStatus(game);
  if (status === "finished") return <Badge>{t("adminPanel.gameFinished")}</Badge>;
  if (status === "lobby") return <Badge tone="info">{t("home.status.lobby")}</Badge>;
  if (paused) return <Badge tone="warning">{t("adminPanel.gamePaused")}</Badge>;
  return <Badge tone="success">{t("home.status.playing")}</Badge>;
}

function GameRow({
  game,
  open,
  onToggle,
}: {
  game: GameListItem;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li
      className="flex flex-col gap-3 rounded-md border border-line bg-surface px-4 py-3"
      data-testid="admin-game"
      data-game-id={game.id}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col">
          <span className="truncate font-semibold">{game.title}</span>
          <span className="truncate text-sm text-muted">
            {game.id} · {t("home.host", { name: game.createdBy.username })} ·{" "}
            {timeAgo(game.createdAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge game={game} />
          {game.isPrivate && <Badge>{t("home.private")}</Badge>}
          <Badge>
            {t("adminPanel.playersCount", { count: playerCount(game), max: game.maxPlayers })}
          </Badge>
        </div>
        <Button size="sm" aria-expanded={open} onClick={onToggle}>
          {open ? t("common.close") : t("adminPanel.manage")}
        </Button>
      </div>
      {open && <GameDetails gameId={game.id} />}
    </li>
  );
}

function GameDetails({ gameId }: { gameId: string }) {
  const { t } = useTranslation();
  const details = useAdminGame(gameId);
  const action = useGameAction();
  const [confirmClose, setConfirmClose] = useState(false);
  const run = (a: GameAction) => action.mutate(a);

  if (details.isLoading) return <Spinner label={t("common.loading")} />;
  if (!details.data)
    return (
      <p role="alert" className="m-0 text-danger">
        {t("adminPanel.gameGone")}
      </p>
    );

  const { game, players, isPaused } = details.data;
  const status = gameStatus(game);
  const busy = action.isPending;
  const order = { showman: 0, player: 1, spectator: 2 } as const;
  const sorted = [...players].sort((a, b) => order[a.role] - order[b.role]);

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-4" data-testid="admin-game-details">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge game={game} paused={isPaused} />
        <span className="text-sm text-muted">
          {t("adminPanel.packageName", { title: game.package.title })}
        </span>
      </div>
      {action.isError && (
        <p role="alert" className="m-0 text-danger">
          {action.error instanceof Error ? action.error.message : t("adminPanel.actionFailed")}
        </p>
      )}
      {sorted.length === 0 ? (
        <p className="m-0 text-muted">{t("adminPanel.nobodyInGame")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label={t("adminPanel.people")}>
          {sorted.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              busy={busy}
              onKick={() => run({ kind: "kick", gameId, playerId: p.id })}
            />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "playing" &&
          (isPaused ? (
            <Button size="sm" disabled={busy} onClick={() => run({ kind: "unpause", gameId })}>
              {t("adminPanel.resume")}
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => run({ kind: "pause", gameId })}>
              {t("adminPanel.pause")}
            </Button>
          ))}
        <Link
          to="/games/$gameId"
          params={{ gameId }}
          className="inline-flex min-h-10 items-center rounded-sm px-3 text-sm font-semibold text-accent hover:underline"
        >
          {t("adminPanel.openGame")}
        </Link>
        {confirmClose ? (
          <>
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={() => {
                setConfirmClose(false);
                run({ kind: "close", gameId });
              }}
            >
              {t("adminPanel.confirmCloseGame")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmClose(false)}>
              {t("common.cancel")}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="danger" onClick={() => setConfirmClose(true)}>
            {t("adminPanel.closeGame")}
          </Button>
        )}
      </div>
      {confirmClose && <p className="m-0 text-sm text-soft">{t("adminPanel.closeGameHelp")}</p>}
    </div>
  );
}

function PlayerRow({
  player,
  busy,
  onKick,
}: {
  player: AdminGamePlayer;
  busy: boolean;
  onKick: () => void;
}) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="flex flex-wrap items-center gap-3" data-testid="admin-game-player">
      <Avatar name={player.username} src={player.avatar} size={32} />
      <span className="min-w-0 flex-[1_1_140px] truncate font-medium">{player.username}</span>
      <Badge tone={player.role === "showman" ? "accent" : "neutral"}>
        {t(`roles.${player.role}`)}
      </Badge>
      {player.role === "player" && (
        <span className="text-sm tabular-nums text-soft">{formatScore(player.score)}</span>
      )}
      {/* Leaving keeps the seat and score as "disconnected"; nothing left to remove */}
      {player.status === "disconnected" ? (
        <Badge tone="warning">{t("adminPanel.offline")}</Badge>
      ) : confirm ? (
        <>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => {
              setConfirm(false);
              onKick();
            }}
          >
            {t("adminPanel.confirmRemove")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            {t("common.cancel")}
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("adminPanel.removeNamed", { name: player.username })}
          onClick={() => setConfirm(true)}
        >
          {t("adminPanel.remove")}
        </Button>
      )}
    </li>
  );
}

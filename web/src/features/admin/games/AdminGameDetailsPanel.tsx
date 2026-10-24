import { layoutStyles } from "@/ui/layoutStyles";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { gameStatus } from "@/features/home/useGames";
import { Button } from "@/ui/Button";
import { Spinner } from "@/ui/Spinner";
import { useAdminGame, useGameAction, type GameAction } from "../useAdmin";
import { GameStatusBadge } from "./GameStatusBadge";
import { AdminGamePlayerRow } from "./AdminGamePlayerRow";
import { adminStyles } from "../adminStyles";

export function AdminGameDetailsPanel({ gameId }: { gameId: string }) {
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
    <div className={adminStyles.gameDetails} data-testid="admin-game-details">
      <div className={layoutStyles.actions}>
        <GameStatusBadge game={game} paused={isPaused} />
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
        <ul className={adminStyles.list} aria-label={t("adminPanel.people")}>
          {sorted.map((p) => (
            <AdminGamePlayerRow
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
        <Link to="/games/$gameId" params={{ gameId }} className={adminStyles.gameLink}>
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

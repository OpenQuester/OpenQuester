import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Player } from "@/game/protocol";
import { myRole, showman, spectators, standings } from "@/game/selectors";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";

import { useGame, useSession } from "../GameContext";
import { PlayerAdminDialog } from "./PlayerAdminDialog";

/**
 * Everyone in the game with their score, in ranking order. The showman also
 * manages players here: fix a score, hand over the turn, seat a spectator or
 * remove someone.
 */
export function PlayersPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const [editing, setEditing] = useState<Player | null>(null);
  const isShowman = myRole(session, myId) === "showman";
  const ranked = standings(session);
  const host = showman(session);
  const watchers = spectators(session);
  const turn = session.state.currentTurnPlayerId;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={t("players.title")}
        side="right"
        closeLabel={t("common.close")}
      >
        <div className="flex flex-col gap-6 p-5" data-testid="players-panel">
          <ol className="m-0 flex list-none flex-col gap-2 p-0" aria-label={t("players.scores")}>
            {ranked.length === 0 && <li className="text-muted">{t("players.none")}</li>}
            {ranked.map((p, i) => (
              <li
                key={p.meta.id}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2.5",
                  p.meta.id === myId
                    ? "border-accent-line bg-accent-surface"
                    : "border-line bg-surface-2",
                  p.status !== "in-game" && "opacity-60",
                )}
                data-testid="players-row"
                data-player={p.meta.username}
              >
                <span className="w-5 text-center font-mono text-muted">{i + 1}</span>
                <Avatar name={p.meta.username} src={p.meta.avatar} size={36} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">
                    {p.meta.username}
                    {p.meta.id === myId && (
                      <span className="font-normal text-muted"> ({t("common.you")})</span>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-x-2 text-xs text-muted">
                    {p.status !== "in-game" && <span>{t("chips.offline")}</span>}
                    {turn === p.meta.id && (
                      <span className="text-accent-strong">{t("players.picksNext")}</span>
                    )}
                  </span>
                </div>
                <b className="font-mono text-lg" data-testid="players-score">
                  {formatScore(p.score)}
                </b>
                {isShowman && (
                  <Button size="sm" onClick={() => setEditing(p)}>
                    {t("players.manage")}
                  </Button>
                )}
              </li>
            ))}
          </ol>

          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-semibold uppercase tracking-wider text-muted">
              {t("roles.showman")}
            </h3>
            <p className="m-0">{host ? host.meta.username : t("players.noShowman")}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-sm font-semibold uppercase tracking-wider text-muted">
              {t("lobby.spectators")} · {watchers.length}
            </h3>
            {watchers.length === 0 && <p className="m-0 text-muted">{t("players.noSpectators")}</p>}
            {watchers.map((p) => (
              <div key={p.meta.id} className="flex items-center gap-3">
                <Avatar name={p.meta.username} src={p.meta.avatar} size={28} />
                <span className="min-w-0 flex-1 truncate">{p.meta.username}</span>
                {isShowman && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      connection.emit("player-role-change", {
                        playerId: p.meta.id,
                        newRole: "player",
                      })
                    }
                  >
                    {t("players.seat")}
                  </Button>
                )}
              </div>
            ))}
          </section>
          {isShowman && <Badge tone="info">{t("players.showmanHelp")}</Badge>}
        </div>
      </Dialog>
      {editing && <PlayerAdminDialog player={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

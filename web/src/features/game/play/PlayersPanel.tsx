import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import type { Player } from "@/game/protocol";
import { myRole, showman, spectators, standings } from "@/game/selectors";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Label, TextInput } from "@/ui/Field";

import { useGame, useSession } from "../GameContext";

/**
 * Everyone in the game with their score, in ranking order. The showman also
 * manages players here, right in the list: fix a score, hand over the turn,
 * seat a spectator or remove someone.
 */
export function PlayersBody({
  compact = false,
  focusPlayer = null,
}: {
  compact?: boolean;
  /** Opens this player's tools right away (showman clicked their chip). */
  focusPlayer?: number | null;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const [editing, setEditing] = useState<number | null>(focusPlayer);
  const isShowman = myRole(session, myId) === "showman";
  const ranked = standings(session);
  const host = showman(session);
  const watchers = spectators(session);
  const turn = session.state.currentTurnPlayerId;

  return (
    <div className={cn("flex flex-col gap-6", compact ? "p-4" : "p-5")} data-testid="players-panel">
      <ol className="m-0 flex list-none flex-col gap-2 p-0" aria-label={t("players.scores")}>
        {ranked.length === 0 && <li className="text-muted">{t("players.none")}</li>}
        {ranked.map((p, i) => (
          <li
            key={p.meta.id}
            className={cn(
              "flex flex-col rounded-md border",
              p.meta.id === myId
                ? "border-accent-line bg-accent-surface"
                : "border-line bg-surface-2",
            )}
            data-testid="players-row"
            data-player={p.meta.username}
          >
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2.5",
                p.status !== "in-game" && "opacity-60",
              )}
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
                <Button
                  size="sm"
                  variant={editing === p.meta.id ? "accent" : "secondary"}
                  aria-expanded={editing === p.meta.id}
                  aria-label={t("admin.manage", { name: p.meta.username })}
                  onClick={() => setEditing((id) => (id === p.meta.id ? null : p.meta.id))}
                >
                  {t("players.manage")}
                </Button>
              )}
            </div>
            {isShowman && editing === p.meta.id && (
              <PlayerAdmin
                key={`${p.meta.id}:${p.score}`}
                player={p}
                onDone={() => setEditing(null)}
              />
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
  );
}

/** Showman tools for one player, opened inline under their row. */
function PlayerAdmin({ player, onDone }: { player: Player; onDone: () => void }) {
  const { t } = useTranslation();
  const { connection } = useGame();
  const session = useSession();
  const [score, setScore] = useState(String(player.score));
  const id = player.meta.id;
  const isTurn = session.state.currentTurnPlayerId === id;
  const inputId = `admin-score-${id}`;

  function onScore(e: FormEvent) {
    e.preventDefault();
    const value = Number(score.replace(/[^\d-]/g, ""));
    if (!Number.isFinite(value)) return;
    connection.emit("score-changed", { playerId: id, newScore: Math.trunc(value) });
    onDone();
  }

  return (
    <div
      className="flex flex-col gap-4 border-t border-line px-3 py-3"
      data-testid="player-admin"
      data-no-shortcuts
    >
      <form onSubmit={onScore} className="flex flex-col gap-2">
        <Label htmlFor={inputId}>{t("admin.score")}</Label>
        <div className="flex gap-2">
          <TextInput
            id={inputId}
            inputMode="numeric"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="font-mono"
          />
          <Button type="submit" variant="primary">
            {t("admin.setScore")}
          </Button>
        </div>
        <p className="m-0 text-sm text-muted">{t("admin.scoreHelp")}</p>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={isTurn}
          onClick={() => {
            connection.emit("turn-player-changed", { newTurnPlayerId: id });
            onDone();
          }}
        >
          {isTurn ? t("admin.isTurn") : t("admin.giveTurn")}
        </Button>
        <Button
          size="sm"
          onClick={() => {
            connection.emit("player-role-change", { playerId: id, newRole: "spectator" });
            onDone();
          }}
        >
          {t("admin.toSpectators")}
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            connection.emit("player-kicked", { playerId: id });
            onDone();
          }}
        >
          {t("admin.kick")}
        </Button>
      </div>
    </div>
  );
}

import { gamePanelStyles } from "./gamePanelStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { myRole, showman, spectators, standings } from "@/game/selectors";
import { cn } from "@/lib/cn";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { ExpandableText } from "@/ui/ExpandableText";

import { useGame, useSession } from "../GameContext";
import { PlayerRow } from "./players/PlayerRow";

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
  const { myId } = useGame();
  const [editing, setEditing] = useState<number | null>(focusPlayer);
  const isShowman = myRole(session, myId) === "showman";
  const ranked = standings(session);
  const host = showman(session);

  return (
    <div className={cn("flex flex-col gap-6", compact ? "p-4" : "p-5")} data-testid="players-panel">
      <ol className={layoutStyles.list} aria-label={t("players.scores")}>
        {ranked.length === 0 && <li className="text-muted">{t("players.none")}</li>}
        {ranked.map((player, index) => (
          <PlayerRow
            key={player.meta.id}
            player={player}
            index={index}
            editing={editing === player.meta.id}
            onToggle={() => setEditing((id) => (id === player.meta.id ? null : player.meta.id))}
            onDone={() => setEditing(null)}
          />
        ))}
      </ol>

      <section className="flex flex-col gap-2">
        <h3 className={gamePanelStyles.playerGroupTitle}>{t("roles.showman")}</h3>
        <p className="m-0">{host ? host.meta.username : t("players.noShowman")}</p>
      </section>
      <SpectatorsBody />
      {isShowman && <Badge tone="info">{t("players.showmanHelp")}</Badge>}
    </div>
  );
}

/** The public side panel; host tools reuse the same spectator seating controls. */
export function SpectatorsBody() {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const isShowman = myRole(session, myId) === "showman";
  const watchers = spectators(session);
  return (
    <section className="flex flex-col gap-2 p-4" data-testid="spectators-panel">
      <h3 className={gamePanelStyles.playerGroupTitle}>
        {t("lobby.spectators")} · {watchers.length}
      </h3>
      {watchers.length === 0 && <p className="m-0 text-muted">{t("players.noSpectators")}</p>}
      {watchers.map((p) => (
        <div key={p.meta.id} className="flex items-center gap-3">
          <Avatar name={p.meta.username} src={p.meta.avatar} size={28} />
          <ExpandableText
            text={p.meta.username}
            className={cn("flex-1", p.meta.id === myId && "text-primary")}
          />
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
  );
}

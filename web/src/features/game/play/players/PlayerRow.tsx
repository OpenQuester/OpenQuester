import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import type { Player } from "@/game/protocol";
import { myRole } from "@/game/selectors";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { useGame, useSession } from "../../GameContext";
import { PlayerModerationForm } from "./PlayerModerationForm";

export function PlayerRow({
  player,
  index,
  editing,
  onToggle,
  onDone,
}: {
  player: Player;
  index: number;
  editing: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const isShowman = myRole(session, myId) === "showman";
  const turn = session.state.currentTurnPlayerId;
  return (
    <li
      className={cn(
        "flex flex-col rounded-md border",
        player.meta.id === myId
          ? "border-accent-line bg-accent-surface"
          : "border-line bg-surface-2",
      )}
      data-testid="players-row"
      data-player={player.meta.username}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5",
          player.status !== "in-game" && "opacity-60",
        )}
      >
        <span className="w-5 text-center font-mono text-muted">{index + 1}</span>
        <Avatar name={player.meta.username} src={player.meta.avatar} size={36} />
        <div className={layoutStyles.contentColumn}>
          <span className="truncate font-semibold">
            {player.meta.username}
            {player.meta.id === myId && (
              <span className="font-normal text-muted"> ({t("common.you")})</span>
            )}
          </span>
          <span className="flex flex-wrap gap-x-2 text-xs text-muted">
            {player.status !== "in-game" && <span>{t("chips.offline")}</span>}
            {turn === player.meta.id && (
              <span className="text-accent-strong">{t("players.picksNext")}</span>
            )}
          </span>
        </div>
        <b className="font-mono text-lg" data-testid="players-score">
          {formatScore(player.score)}
        </b>
        {isShowman && (
          <Button
            size="sm"
            variant={editing ? "accent" : "secondary"}
            aria-expanded={editing}
            aria-label={t("admin.manage", { name: player.meta.username })}
            onClick={onToggle}
          >
            {t("players.manage")}
          </Button>
        )}
      </div>
      {isShowman && editing && (
        <PlayerModerationForm
          key={`${player.meta.id}:${player.score}`}
          player={player}
          onDone={onDone}
        />
      )}
    </li>
  );
}

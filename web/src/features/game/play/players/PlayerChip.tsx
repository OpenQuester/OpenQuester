import { useTranslation } from "react-i18next";
import type { Player } from "@/game/protocol";
import { myRole } from "@/game/selectors";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { useGame, useSession } from "../../GameContext";
import { chipState } from "./chipState";

export function ChipName({ name }: { name: string }) {
  return (
    <span className="max-w-[18ch] truncate sm:max-w-[24ch]" title={name}>
      {name}
    </span>
  );
}

export function PlayerChip({
  player,
  onManage,
  finalContentPlaying = false,
  pointWaiting = false,
}: {
  player: Player;
  onManage?: (playerId: number) => void;
  finalContentPlaying?: boolean;
  pointWaiting?: boolean;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const isShowman = myRole(session, myId) === "showman";

  const chip = chipState(session, player, t, finalContentPlaying, pointWaiting);
  const isMe = player.meta.id === myId;
  const content = (
    <>
      <Avatar
        name={player.meta.username}
        src={player.meta.avatar}
        size={28}
        muted={player.status !== "in-game"}
      />
      {/* "(you)" sits outside the name so a long name never hides it */}
      <ChipName name={player.meta.username} />
      {isMe && <span className="-ml-1 shrink-0 text-muted">({t("common.you")})</span>}
      <b className="font-mono" data-testid="chip-score">
        {formatScore(player.score)}
      </b>
      {chip.tag && (
        <span className={cn("text-xs font-semibold", chip.hot ? "text-accent" : "text-muted")}>
          {chip.tag}
        </span>
      )}
    </>
  );
  const cls = cn(
    "flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm",
    chip.hot ? "border-accent-line bg-accent-surface" : "border-transparent bg-surface-2",
    chip.dim && "opacity-50",
  );
  return (
    <li data-testid="player-chip" data-player={player.meta.username}>
      {isShowman && onManage ? (
        <button
          type="button"
          className={cn(cls, "text-text hover:border-line-strong")}
          onClick={() => onManage?.(player.meta.id)}
          aria-label={t("admin.manage", { name: player.meta.username })}
        >
          {content}
        </button>
      ) : (
        <span className={cls}>{content}</span>
      )}
    </li>
  );
}

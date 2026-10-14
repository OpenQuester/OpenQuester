import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

import type { GameSession } from "@/game/reducer";
import type { Player } from "@/game/protocol";
import {
  hasFinalBid,
  hasSkipped,
  myRole,
  phaseOf,
  seatedPlayers,
  showman,
  stakeInfo,
} from "@/game/selectors";
import { formatScore, formatSigned } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";

import { useGame, useSession } from "../GameContext";

interface ChipState {
  tag: string;
  hot: boolean;
  dim: boolean;
}

/** Score bar: every seated player, their score, and what they are doing now. */
export function PlayerChips({ onManage }: { onManage?: (playerId: number) => void }) {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const isShowman = myRole(session, myId) === "showman";
  const host = showman(session);
  const players = seatedPlayers(session);

  return (
    <>
      <ul
        className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-0.5 [scrollbar-width:thin]"
        aria-label={t("game.scores")}
      >
        {host && (
          <li className="flex shrink-0 items-center gap-2 rounded-full border border-accent-line/60 bg-surface py-1 pl-1 pr-3 text-sm">
            <Avatar name={host.meta.username} src={host.meta.avatar} size={28} />
            <span className="max-w-[12ch] truncate">{host.meta.username}</span>
            <span className="text-xs font-semibold text-accent-strong">{t("roles.showman")}</span>
          </li>
        )}
        {players.map((p) => {
          const chip = chipState(session, p, t);
          const isMe = p.meta.id === myId;
          const content = (
            <>
              <Avatar
                name={p.meta.username}
                src={p.meta.avatar}
                size={28}
                muted={p.status !== "in-game"}
              />
              <span className="max-w-[12ch] truncate">
                {p.meta.username}
                {isMe && <span className="text-muted"> ({t("common.you")})</span>}
              </span>
              <b className="font-mono" data-testid="chip-score">
                {formatScore(p.score)}
              </b>
              {chip.tag && (
                <span
                  className={cn("text-xs font-semibold", chip.hot ? "text-accent" : "text-muted")}
                >
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
            <li key={p.meta.id} data-testid="player-chip" data-player={p.meta.username}>
              {isShowman ? (
                <button
                  type="button"
                  className={cn(cls, "text-text hover:border-line-strong")}
                  onClick={() => onManage?.(p.meta.id)}
                  aria-label={t("admin.manage", { name: p.meta.username })}
                >
                  {content}
                </button>
              ) : (
                <span className={cls}>{content}</span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function chipState(
  session: GameSession,
  p: Player,
  t: (k: string, o?: Record<string, unknown>) => string,
): ChipState {
  const id = p.meta.id;
  const s = session.state;
  const none: ChipState = { tag: "", hot: false, dim: false };
  if (p.status !== "in-game") return { tag: t("chips.offline"), hot: false, dim: true };
  switch (phaseOf(session)) {
    case "choosing":
      return s.currentTurnPlayerId === id ? { tag: t("chips.picks"), hot: true, dim: false } : none;
    case "media":
      return p.mediaDownloaded ? none : { tag: t("chips.loading"), hot: false, dim: false };
    case "showing":
    case "answering": {
      if (s.answeringPlayer === id) return { tag: t("chips.answering"), hot: true, dim: false };
      const answer = (s.answeredPlayers ?? []).find((a) => a.player === id);
      if (answer) return { tag: formatSigned(answer.result), hot: false, dim: true };
      if (hasSkipped(session, id)) return { tag: t("chips.passed"), hot: false, dim: true };
      return none;
    }
    case "reveal": {
      const last = (s.answeredPlayers ?? []).filter((a) => a.player === id).at(-1);
      if (last)
        return { tag: formatSigned(last.result), hot: last.answerType === "correct", dim: false };
      return none;
    }
    case "secret_transfer":
      return s.secretQuestionData?.pickerPlayerId === id
        ? { tag: t("chips.givingAway"), hot: true, dim: false }
        : none;
    case "stake_bidding": {
      const info = stakeInfo(session);
      if (!info) return none;
      if (info.stake.passedPlayers.includes(id))
        return { tag: t("chips.passed"), hot: false, dim: true };
      if (info.bidderId === id) return { tag: t("chips.bidding"), hot: true, dim: false };
      const bid = info.stake.bids[String(id)];
      return bid != null ? { tag: formatScore(bid), hot: false, dim: false } : none;
    }
    case "all_play_bidding":
    case "all_play_answering": {
      const entry = s.allPlay?.entries.find((e) => e.playerId === id);
      if (!entry) return none;
      const done = phaseOf(session) === "all_play_bidding" ? entry.stake != null : entry.submitted;
      return done
        ? { tag: t("chips.answered"), hot: false, dim: false }
        : { tag: t("chips.typing"), hot: true, dim: false };
    }
    case "all_play_reviewing": {
      const entry = s.allPlay?.entries.find((e) => e.playerId === id);
      if (!entry || entry.scoreChange == null) return none;
      return { tag: formatSigned(entry.scoreChange), hot: !!entry.isCorrect, dim: false };
    }
    case "final_elimination":
      return s.currentTurnPlayerId === id
        ? { tag: t("chips.removing"), hot: true, dim: false }
        : none;
    case "final_bidding":
      return hasFinalBid(session, id)
        ? { tag: t("chips.bidPlaced"), hot: false, dim: false }
        : { tag: t("chips.bidding"), hot: true, dim: false };
    case "final_answering":
      return session.finalSubmitted.includes(id)
        ? { tag: t("chips.answered"), hot: false, dim: false }
        : { tag: t("chips.typing"), hot: true, dim: false };
    default:
      return none;
  }
}

import type { GameSession } from "@/game/reducer";
import type { Player } from "@/game/protocol";
import { hasFinalBid, hasSkipped, phaseOf, stakeInfo } from "@/game/selectors";
import { formatScore, formatSigned } from "@/lib/format";

interface ChipState {
  tag: string;
  hot: boolean;
  dim: boolean;
}

export function chipState(
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

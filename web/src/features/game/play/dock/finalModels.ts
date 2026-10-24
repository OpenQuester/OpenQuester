import { formatScore } from "@/lib/format";
import { type ActionDockModel, type ActionDockContext } from "./actionDockModel";

import {
  finalBid,
  isEligible,
  me as findMe,
  myRole,
  remainingFinalThemes,
  seatedPlayers,
} from "@/game/selectors";

export function finalEliminationModel({
  t,
  session,
  myId,
  role,
  name,
  reason,
}: ActionDockContext): ActionDockModel {
  const s = session.state;
  const turn = s.currentTurnPlayerId;
  const left = remainingFinalThemes(session).length;
  return {
    status:
      turn === myId
        ? t("dock.final.elimYou")
        : role === "showman"
          ? t("dock.final.elimShowman", { name: name(turn) })
          : t("dock.final.elimOther", { name: name(turn) }),
    action: {
      kind: "info",
      text:
        turn === myId || role === "showman" ? t("dock.final.elimInfo") : reason("not_your_turn"),
    },
    next: t("dock.final.elimNext", { count: left }),
  };
}

export function finalBidModel({ reason, t, session, myId }: ActionDockContext): ActionDockModel {
  const role = myRole(session, myId);
  const mePlayer = findMe(session, myId);
  const players = seatedPlayers(session).filter((p) => isEligible(session, p.meta.id));
  const placed = players.filter((p) => finalBid(session, p.meta.id) != null).length;
  const myBid = finalBid(session, myId);
  const next = t("dock.final.bidNext");
  if (role !== "player") {
    return {
      status: t("dock.final.bidsIn", { done: placed, total: players.length }),
      action: { kind: "info", text: t("dock.final.bidShowman") },
      next,
    };
  }
  if (!isEligible(session, myId) || (mePlayer?.score ?? 0) <= 0) {
    return {
      status: t("dock.final.sitOut"),
      action: { kind: "info", text: reason("not_eligible") },
      next,
    };
  }
  if (myBid != null) {
    return {
      status: t("dock.final.bidLocked", { amount: formatScore(myBid) }),
      action: {
        kind: "info",
        text: t("dock.final.waitOthers", { done: placed, total: players.length }),
      },
      next,
    };
  }
  const score = mePlayer!.score;
  return {
    status: t("dock.final.bidRange", { max: formatScore(score) }),
    action: { kind: "bid", event: "final-bid-submit", min: 1, max: score, allIn: score },
    next,
  };
}

export function finalAnswerModel({ t, session, myId, reason }: ActionDockContext): ActionDockModel {
  const role = myRole(session, myId);
  const players = seatedPlayers(session).filter(
    (p) => isEligible(session, p.meta.id) && finalBid(session, p.meta.id) != null,
  );
  const done = players.filter((p) => session.finalSubmitted.includes(p.meta.id)).length;
  const next = t("dock.final.answerNext");
  if (role !== "player") {
    return {
      status: t("dock.final.answersIn", { done, total: players.length }),
      action: { kind: "info", text: t("dock.final.answerShowman") },
      next,
    };
  }
  if (finalBid(session, myId) == null || !isEligible(session, myId)) {
    return {
      status: t("dock.final.sitOut"),
      action: { kind: "info", text: reason("not_eligible") },
      next,
    };
  }
  if (session.finalSubmitted.includes(myId)) {
    return {
      status: t("dock.final.answerLocked"),
      action: { kind: "info", text: t("dock.final.waitOthers", { done, total: players.length }) },
      next,
    };
  }
  return {
    status: t("dock.final.typeAnswer", { amount: formatScore(finalBid(session, myId) ?? 0) }),
    action: { kind: "timed-answer" },
    next,
  };
}

export function finalReviewModel({ t, role, session }: ActionDockContext): ActionDockModel {
  const s = session.state;
  const answers = s.finalRoundData?.answers ?? [];
  const done = answers.filter((a) => a.isCorrect != null || a.autoLoss).length;
  return {
    status: t("dock.final.reviewStatus", { done, total: answers.length }),
    action: {
      kind: "info",
      text: role === "showman" ? t("dock.final.reviewShowman") : t("dock.final.reviewWait"),
    },
    next: t("dock.final.reviewNext"),
    ringLabel: `${done}/${answers.length}`,
  };
}

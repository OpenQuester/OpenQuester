import { formatScore } from "@/lib/format";
import { type ActionDockModel, type ActionDockContext } from "./actionDockModel";

import { allPlayMaxStake, allPlayStakes, myAllPlayEntry, pointPicture } from "@/game/selectors";

export function allPlayStakeModel({
  t,
  session,
  myId,
  sending,
}: ActionDockContext): ActionDockModel {
  const entries = session.state.allPlay?.entries ?? [];
  const placed = entries.filter((e) => e.stake != null).length;
  const mine = myAllPlayEntry(session, myId);
  const next = t("dock.allPlay.stakeNext");
  if (!mine) {
    return {
      status: t("dock.final.bidsIn", { done: placed, total: entries.length }),
      action: { kind: "info", text: t("dock.allPlay.stakeWatch") },
      next,
    };
  }
  if (mine.stake != null) {
    return {
      status: t("dock.allPlay.stakeLocked"),
      action: {
        kind: "info",
        text: t("dock.final.waitOthers", { done: placed, total: entries.length }),
      },
      next,
    };
  }
  const max = allPlayMaxStake(session, myId);
  return {
    status: t("dock.final.bidRange", { max: formatScore(max) }),
    action: {
      kind: "bid",
      event: "all-play-stake",
      range: { min: 1, max },
      allIn: max,
      pending: sending("all-play-stake"),
    },
    next,
  };
}

export function allPlayAnswerModel({
  t,
  session,
  myId,
  pointImageReady,
}: ActionDockContext): ActionDockModel {
  const entries = session.state.allPlay?.entries ?? [];
  const done = entries.filter((e) => e.submitted).length;
  const mine = myAllPlayEntry(session, myId);
  const stakes = allPlayStakes(session, mine ?? { stake: null });
  const auto =
    session.state.currentQuestion?.answerType === "number" ||
    session.state.currentQuestion?.answerType === "point";
  const next =
    session.state.allPlay?.mode === "stake"
      ? t(auto ? "dock.allPlay.answerNextStakeAuto" : "dock.allPlay.answerNextStake")
      : t(auto ? "dock.allPlay.answerNextNoRiskAuto" : "dock.allPlay.answerNextNoRisk", {
          points: formatScore(stakes.win),
        });
  if (!mine) {
    return {
      status: t("dock.final.answersIn", { done, total: entries.length }),
      action: { kind: "info", text: t("dock.allPlay.answerWatch") },
      next,
    };
  }
  if (mine.submitted) {
    return {
      status: t("dock.final.answerLocked"),
      action: { kind: "info", text: t("dock.final.waitOthers", { done, total: entries.length }) },
      next,
    };
  }
  const q = session.state.currentQuestion;
  if (q?.answerType === "point" && !pointPicture(q)) {
    const message = t("point.finalPictureUnavailable");
    return { status: message, action: { kind: "info", text: message }, next: "" };
  }
  if (q?.answerType === "point" && pointImageReady === false) {
    const message = t("point.pictureWaiting");
    return { status: message, action: { kind: "info", text: message }, next: "" };
  }
  return {
    status: t("dock.allPlay.typeAnswer"),
    action: pointPicture(q)
      ? { kind: "info", text: t("point.prompt") }
      : { kind: "timed-answer", event: "all-play-answer", numeric: q?.answerType === "number" },
    next,
  };
}

export function allPlayReviewModel({ t, role, session }: ActionDockContext): ActionDockModel {
  const s = session.state;
  const entries = s.allPlay?.entries ?? [];
  const done = entries.filter((e) => e.isCorrect != null).length;
  return {
    status: t("dock.final.reviewStatus", { done, total: entries.length }),
    action: {
      kind: "info",
      text: role === "showman" ? t("dock.allPlay.reviewShowman") : t("dock.final.reviewWait"),
    },
    next: t("dock.allPlay.reviewNext"),
    ringLabel: `${done}/${entries.length}`,
  };
}

import { formatScore, formatSigned } from "@/lib/format";

import { type ActionDockModel, type ActionDockContext } from "./actionDockModel";
import { allPlayRevealStatus } from "../allPlayRevealText";

import {
  canBuzz,
  canManuallyJudge,
  hasSkipped,
  isSingleAnswerer,
  pointPicture,
  wrongCostsPoints,
} from "@/game/selectors";

export function showingModel({
  t,
  session,
  myId,
  role,
  value,
  sending,
  reason,
  buzzer,
}: ActionDockContext): ActionDockModel {
  const s = session.state;
  const wrongPart = wrongCostsPoints(session)
    ? t("dock.showing.wrongCost", { points: formatScore(value) })
    : t("dock.showing.wrongFree");
  const next = t(
    session.settings?.buttonPressMode === "random_within_window"
      ? "dock.showing.nextWindow"
      : "dock.showing.next",
    { points: formatScore(value), wrong: wrongPart },
  );
  if (role === "showman") {
    const early = !buzzer.open;
    return {
      status: early ? t("dock.showing.showmanWait") : t("dock.showing.showmanStatus"),
      action: {
        kind: "show-question",
        early,
        opening: sending("buzzer-open"),
        revealing: sending("skip-question-force"),
      },
      next: early ? t("dock.showing.showmanNextEarly") : t("dock.showing.showmanNext"),
    };
  }
  if (role === "spectator") {
    return {
      status: t("dock.showing.status"),
      action: { kind: "info", text: t("reasons.wrong_role_watch") },
      next,
    };
  }
  const can = canBuzz(session, myId);
  if (!can.ok) {
    const skipped = hasSkipped(session, myId);
    return {
      status: t("dock.showing.status"),
      action: {
        kind: "info",
        text:
          can.reason === "false_start"
            ? t("dock.showing.locked", { seconds: Math.ceil(buzzer.lockLeftMs / 1000) })
            : reason(can.reason),
        unpass: skipped,
      },
      next,
    };
  }
  // Before the buzzer opens the button stays pressable (an early press is a
  // false start) but reads as "wait" so nobody mistakes it for open.
  const early = !buzzer.open;
  return {
    status: early ? t("dock.showing.wait") : t("dock.showing.open"),
    action: {
      kind: "buzz",
      early,
      answering: sending("question-answer"),
      passing: sending("question-skip"),
      canPass: !isSingleAnswerer(s.currentQuestion),
    },
    next,
  };
}

export function answeringModel({
  t,
  session,
  myId,
  role,
  name,
  value,
  sending,
  pointImageReady,
}: ActionDockContext): ActionDockModel {
  const s = session.state;
  const answerer = s.answeringPlayer;
  const q = s.currentQuestion;
  const single = isSingleAnswerer(q);
  if (role === "showman") {
    if (!canManuallyJudge(session)) {
      const message = t(
        !q
          ? "dock.answering.questionLoading"
          : session.hasAnswerSubmission
            ? "dock.answering.autoSubmittedHelp"
            : "dock.answering.autoWaitHelp",
      );
      return {
        statusPlayer: q
          ? {
              key: session.hasAnswerSubmission
                ? "dock.answering.autoSubmitted"
                : "dock.answering.autoWait",
              name: name(answerer),
            }
          : undefined,
        status: !q
          ? message
          : t(
              session.hasAnswerSubmission
                ? "dock.answering.autoSubmitted"
                : "dock.answering.autoWait",
              { name: name(answerer) },
            ),
        action: { kind: "judge-wait", pending: sending("answer-result"), message },
        next: q && !session.hasAnswerSubmission ? t("dock.answering.autoWaitNext") : "",
      };
    }
    const wrong = wrongCostsPoints(session) ? -value : 0;
    return {
      statusPlayer: { key: "dock.answering.judge", name: name(answerer) },
      status: t("dock.answering.judge", { name: name(answerer) }),
      action: { kind: "judge", value, wrong, pending: sending("answer-result") },
      next:
        q?.type === "choice"
          ? t("dock.answering.showmanChoice", { name: name(answerer) })
          : single
            ? t("dock.answering.showmanNextSingle", { name: name(answerer) })
            : t("dock.answering.showmanNext", {
                name: name(answerer),
                points: formatScore(value),
              }),
    };
  }
  if (!q) {
    const message = t("dock.answering.questionLoading");
    return { status: message, action: { kind: "info", text: message }, next: "" };
  }
  if (answerer === myId && q.answerType === "point" && !pointPicture(q)) {
    const message = t("point.pictureUnavailable");
    return { status: message, action: { kind: "info", text: message }, next: "" };
  }
  if (answerer === myId && q.answerType === "point" && pointImageReady === false) {
    const message = t("point.pictureWaiting");
    return { status: message, action: { kind: "info", text: message }, next: "" };
  }
  if (answerer === myId) {
    return {
      status: t("dock.answering.you"),
      action: {
        kind: "answer",
        mode:
          q?.type === "choice"
            ? "choice"
            : pointPicture(q)
              ? "point"
              : q?.answerType === "number"
                ? "number"
                : "text",
        canGiveUp: single,
        pending: sending("question-skip"),
      },
      next:
        q?.type === "choice"
          ? t("dock.answering.choiceNext")
          : q?.answerType === "number" || q?.answerType === "point"
            ? t("dock.answering.autoNext")
            : single
              ? t("dock.answering.youNextSingle")
              : t("dock.answering.youNext"),
    };
  }
  return {
    statusPlayer: { key: "dock.answering.other", name: name(answerer) },
    status: t("dock.answering.other", { name: name(answerer) }),
    action: {
      kind: "info",
      text: role === "spectator" ? t("reasons.wrong_role_watch") : t("dock.answering.wait"),
    },
    next: single
      ? t("dock.answering.otherNextSingle", { name: name(answerer) })
      : t("dock.answering.otherNext", { name: name(answerer) }),
  };
}

export function revealModel({
  t,
  role,
  name,
  sending,
  session,
}: ActionDockContext): ActionDockModel {
  const s = session.state;
  const result = s.answerShowData?.answerResult ?? (s.answeredPlayers ?? []).at(-1);
  const correct = result?.answerType === "correct";
  const allPlaySummary = allPlayRevealStatus(session, t);
  const nextPicker = s.answerShowData?.nextTurnPlayerId ?? s.currentTurnPlayerId;
  return {
    statusPlayer:
      !allPlaySummary && correct
        ? {
            key: "dock.reveal.correct",
            name: name(result?.player),
            values: { points: formatSigned(result!.result) },
          }
        : undefined,
    status:
      allPlaySummary ??
      (correct
        ? t("dock.reveal.correct", {
            name: name(result?.player),
            points: formatSigned(result!.result),
          })
        : t("dock.reveal.nobody")),
    action:
      role === "showman"
        ? { kind: "continue", pending: sending("skip-show-answer") }
        : { kind: "info", text: t("dock.reveal.info") },
    next: nextPicker
      ? t("dock.reveal.next", { name: name(nextPicker) })
      : t("dock.reveal.nextBoard"),
  };
}

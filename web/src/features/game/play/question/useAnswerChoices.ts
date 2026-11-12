import { preloadQuestionMedia } from "@/game/media";
import { questionMediaFiles } from "@/game/questionMediaFiles";
import { useEffect, useState } from "react";
import { timerElapsed } from "@/game/contentPlan";
import type { Question, ChoiceAnswer } from "@/game/protocol";
import type { GameSession } from "@/game/reducer";
import { serverNow } from "@/lib/clock";
import { timerStartDelay } from "@/lib/timer";
import {
  answerWindowOpensIn,
  myRole,
  phaseOf,
  canAnswerNow,
  myAllPlayEntry,
} from "@/game/selectors";
import { useGame, useGameState, useGameStoreApi, useSession } from "../../GameContext";
import { optionAnswer } from "./optionAnswer";

/** Stake and secret assign an answerer before presentation. Single no-risk uses the buzzer. */
function isDirectAnswer(question: Question | null | undefined) {
  return question?.type === "stake" || question?.type === "secret";
}

/** Null means preparation has no playback clock yet. */
function optionsShowIn(session: GameSession): number | null {
  const s = session.state;
  const phase = phaseOf(session);
  if (phase === "media") return null;
  if (s.scriptView?.waitingFor === "answer") return answerWindowOpensIn(session);

  const q = s.currentQuestion;
  if (
    phase === "all_play_answering" ||
    phase === "final_answering" ||
    (phase === "answering" && isDirectAnswer(q))
  ) {
    const delay = answerWindowOpensIn(session);
    return Number.isFinite(delay) ? delay : null;
  }
  // A buzz starts a fresh answer timer, after the question presentation.
  if (phase !== "showing") return 0;

  const contentMs =
    session.content?.kind === "question"
      ? session.content.plan.totalMs
      : (s.questionContentPlan?.totalMs ?? 0);
  // The server's regular gate includes caption reading time and the option delay.
  const showAt = s.buzzerOpensAtMs || contentMs + Math.max(0, q?.showDelay ?? 0);
  if (!s.timer && showAt > 0) return null;
  const now = (s.isPaused ? s.pausedAt : null) ?? serverNow();
  return (
    timerStartDelay(s.timer, now) + Math.max(0, showAt - timerElapsed(s.timer, s.isPaused, now))
  );
}

function useOptionsVisible(session: GameSession): boolean {
  const [tick, setTick] = useState(0);
  const delay = optionsShowIn(session);
  const paused = session.state.isPaused;
  useEffect(() => {
    if (!delay || paused) return;
    // Wake up at the deadline and re-read the current presentation gate.
    const id = window.setTimeout(() => setTick((value) => value + 1), Math.ceil(delay));
    return () => window.clearTimeout(id);
  }, [delay, paused, tick]);
  return delay === 0;
}

/** Keep the reveal timer and selected answer in the keyed choice component. */
export function useAnswerChoices(q: Question) {
  const store = useGameStoreApi();
  const session = useSession();
  const { connection, myId } = useGame();
  const pending = useGameState((st) => st.pending);
  const online = useGameState((st) => st.connection === "connected");
  const s = session.state;
  const phase = phaseOf(session);
  const { event, submitted } = choiceSubmission(session, myId);
  const role = myRole(session, myId);
  const visible = useOptionsVisible(session);
  const answering = visible && canAnswerNow(session, myId) && !s.isPaused && online;
  const needsPreload =
    phase === "answering" && isDirectAnswer(q) && questionMediaFiles(q).length > 0;
  const { mediaReady, preloadFailed, retryMedia } = useDirectChoiceMedia(q, needsPreload);
  const [picked, setPicked] = useState<number | null>(null);

  const answers = [...(q.answers ?? [])].sort((a, b) => a.order - b.order);
  const rejected = new Set(
    (s.allPlay || s.currentRound?.type === "final" ? [] : (s.answeredPlayers ?? []))
      .filter((attempt) => attempt.answerType === "wrong" && attempt.choiceOrder != null)
      .map((attempt) => attempt.choiceOrder),
  );
  const correct = role === "showman" ? q.answerText?.trim().toLowerCase() : undefined;
  const correctOrder = role === "showman" ? q.correctChoiceOrder : undefined;
  // Locked while the pick is on its way or accepted; a failed send unlocks it
  const locked = pending?.action === event || submitted;

  function pick(a: ChoiceAnswer, i: number) {
    const latest = store.getState();
    if (
      !answering ||
      !mediaReady ||
      locked ||
      rejected.has(a.order) ||
      latest.pending?.action === event ||
      !latest.session ||
      latest.session.state.isPaused ||
      optionsShowIn(latest.session) !== 0
    )
      return;
    setPicked(i);
    connection.emit(event, {
      answerText: optionAnswer(a.text, i, answers),
      ...(answers.filter((option) => option.order === a.order).length === 1
        ? { choiceOrder: a.order }
        : {}),
    });
  }
  return {
    visible,
    mediaReady,
    preloadFailed,
    retryMedia,
    answers,
    correct,
    correctOrder,
    answering: answering && mediaReady,
    locked,
    picked,
    pick,
    rejected,
  };
}

/** Direct specials enter answering immediately; load their resources before enabling picks. */
function useDirectChoiceMedia(q: Question, needsPreload: boolean) {
  const [preloadAttempt, setPreloadAttempt] = useState(0);
  const [preloadFailed, setPreloadFailed] = useState(false);
  const [prepared, setPrepared] = useState<typeof q | null>(null);
  useEffect(() => {
    if (!needsPreload) return;
    const controller = new AbortController();
    void preloadQuestionMedia(q, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        if (result !== null) setPrepared(q);
        setPreloadFailed(result === null);
      }
    });
    return () => controller.abort();
  }, [needsPreload, q, preloadAttempt]);
  const mediaReady = !needsPreload || prepared === q;
  return {
    mediaReady,
    preloadFailed,
    retryMedia: () => {
      setPreloadFailed(false);
      setPreloadAttempt((value) => value + 1);
    },
  };
}

/** All-play/final readiness is public, while answers stay private until review. */
function choiceSubmission(session: GameSession, myId: number) {
  switch (phaseOf(session)) {
    case "all_play_answering":
      return {
        event: "all-play-answer" as const,
        submitted: !!myAllPlayEntry(session, myId)?.submitted,
      };
    case "final_answering":
      return {
        event: "final-answer-submit" as const,
        submitted: session.finalSubmitted.includes(myId),
      };
    default:
      return { event: "answer-submitted" as const, submitted: session.submittedAnswer != null };
  }
}

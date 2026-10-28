import { useEffect, useState } from "react";
import { timerElapsed } from "@/game/contentPlan";
import type { ChoiceAnswer } from "@/game/protocol";
import type { GameSession } from "@/game/reducer";
import { myRole, phaseOf } from "@/game/selectors";
import { useGame, useGameState, useSession } from "../../GameContext";
import { optionAnswer } from "./optionAnswer";

/**
 * Milliseconds until a choice question's options appear, on the question's own
 * timeline: with false starts on, just before the buzzer opens
 * (`buzzerOpensAtMs`); otherwise after the content and package's show delay. Both count on
 * the question timer, so options stay shown once revealed (after a buzz, or
 * when the component remounts) and wait while the game is paused.
 */
function optionsShowIn(session: GameSession): number {
  const s = session.state;
  const phase = phaseOf(session);
  const contentMs =
    session.content?.kind === "question"
      ? session.content.plan.totalMs
      : (s.questionContentPlan?.totalMs ?? 0);
  const showAt = s.buzzerOpensAtMs || contentMs + (s.currentQuestion?.showDelay ?? 0);

  // Once the question is open and someone answers, the options were shown
  if (phase !== "showing" && phase !== "media") return 0;
  if (phase === "media") return showAt;

  return Math.max(0, showAt - timerElapsed(s.timer, s.isPaused));
}

/** Keep the reveal timer and selected answer in the keyed choice component. */
export function useAnswerChoices() {
  const session = useSession();
  const { connection, myId } = useGame();
  const pending = useGameState((st) => st.pending);
  const online = useGameState((st) => st.connection === "connected");
  const s = session.state;
  const q = s.currentQuestion!;
  const role = myRole(session, myId);
  const answering =
    s.answeringPlayer === myId && phaseOf(session) === "answering" && !s.isPaused && online;
  const [visible, setVisible] = useState(() => optionsShowIn(session) <= 0);
  const [picked, setPicked] = useState<number | null>(null);
  const showIn = optionsShowIn(session);

  useEffect(() => {
    // A paused game holds its timeline still: nothing appears until it resumes
    if (visible || s.isPaused) return;
    const id = window.setTimeout(() => setVisible(true), showIn);
    return () => window.clearTimeout(id);
  }, [visible, s.isPaused, showIn]);

  const answers = [...(q.answers ?? [])].sort((a, b) => a.order - b.order);
  const rejected = new Set(
    (s.answeredPlayers ?? [])
      .filter((attempt) => attempt.answerType === "wrong" && attempt.choiceOrder != null)
      .map((attempt) => attempt.choiceOrder),
  );
  const correct = role === "showman" ? q.answerText?.trim().toLowerCase() : undefined;
  // Locked while the pick is on its way or accepted; a failed send unlocks it
  const locked = pending?.action === "answer-submitted" || session.submittedAnswer != null;

  function pick(a: ChoiceAnswer, i: number) {
    if (!answering || locked || rejected.has(a.order)) return;
    setPicked(i);
    connection.emit("answer-submitted", {
      answerText: optionAnswer(a.text, i, answers),
      ...(answers.filter((option) => option.order === a.order).length === 1
        ? { choiceOrder: a.order }
        : {}),
    });
  }
  return { visible, answers, correct, answering, locked, picked, pick, rejected };
}

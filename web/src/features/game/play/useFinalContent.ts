import { useMemo } from "react";

import { buildContentPlan } from "@/game/contentPlan";
import type { GameSession, ContentClock } from "@/game/reducer";
import { useAnswerWindowReady } from "./question/useQuestionStage";

const EMPTY_PLAN = { steps: [{ startMs: 0, durationMs: 0, items: [] }], totalMs: 0 };

/** Final-round content shares the final timer, including pause and rejoin. */
export function useFinalContent(session: GameSession) {
  const data = session.state.finalRoundData?.questionData;
  const legacy =
    data?.contentPlan === null ||
    (data?.contentPlan === undefined && data?.question.textItems == null);
  const plan = useMemo(() => {
    if (!data) return null;
    if (data.contentPlan) return data.contentPlan;
    const q = data.question;
    return buildContentPlan({
      text: q.text,
      answerDurationMs: q.answerDurationMs,
      textDurationMs: q.textDurationMs,
      textWaitForFinish: q.textWaitForFinish,
      textOrder: q.textOrder,
      textItems: q.textItems,
      playMediaSimultaneously: q.playMediaSimultaneously,
      files: q.questionFiles,
    });
  }, [data]);
  const clock: ContentClock = {
    kind: "question",
    plan: plan ?? EMPTY_PLAN,
    timer: plan ? session.state.timer : null,
    // A reconnect can briefly have a plan but no timer. Keep the first step
    // until the server restores the clock instead of exposing a later step.
    frozenAtMs: plan && !session.state.timer ? 0 : null,
  };
  const answerWindowReady = useAnswerWindowReady(session);
  return { content: plan ? clock : null, playing: !answerWindowReady, legacy };
}

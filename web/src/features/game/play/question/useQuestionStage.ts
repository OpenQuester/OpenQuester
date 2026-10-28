import { useEffect, useState } from "react";
import { timerElapsed } from "@/game/contentPlan";
import type { GameSession } from "@/game/reducer";
import { canAnswerNow, pointPicture, boardQuestionMeta, myRole, phaseOf } from "@/game/selectors";
import { useGame, useSession } from "../../GameContext";

/** Derive the question view from the authoritative session and content clock. */
export function useQuestionStage() {
  const session = useSession();
  const { myId } = useGame();
  const s = session.state;
  const phase = phaseOf(session);
  const role = myRole(session, myId);
  const q = s.currentQuestion;
  const meta = boardQuestionMeta(
    session,
    q?.id ?? s.stakeQuestionData?.questionId ?? s.secretQuestionData?.questionId,
  );
  const reveal = phase === "reveal";
  const gated = phase === "media" && role !== "showman";
  const playing = phase === "showing" && !s.isPaused;
  const content = session.content;
  const showmanPreview = phase === "media" && role === "showman";
  // A sequenced text appears in its own step instead of under the media.
  const textIsStep =
    content?.kind === "question" &&
    content.plan.steps.some((st) => st.items.some((i) => i.kind === "text"));
  const price = s.stakeQuestionData?.highestBid ?? q?.price ?? meta?.question.price ?? null;
  // Point answers: the player who answers now clicks the spot on the picture.
  const picture = pointPicture(q);
  const picking = !!picture && canAnswerNow(session, myId);
  // Once the content has played, the stage would otherwise go quiet (a sound
  // that ended leaves nothing on it): say what happens now instead.
  const contentDone = useContentDone(session.content, s.isPaused);
  const cue = phase === "showing" && contentDone && !picking;

  return {
    myId,
    s,
    phase,
    role,
    q,
    meta,
    reveal,
    gated,
    playing,
    content,
    showmanPreview,
    textIsStep,
    price,
    picture,
    picking,
    cue,
  };
}

/** True once the question's content timeline has played to the end. */
function useContentDone(content: GameSession["content"], paused: boolean): boolean {
  const [, setTick] = useState(0);
  const running = !!content?.timer && content.frozenAtMs == null && !paused;
  const elapsed = !content
    ? 0
    : (content.frozenAtMs ??
      (content.timer ? timerElapsed(content.timer, paused) : content.plan.totalMs));
  const total = content?.plan.totalMs ?? 0;
  const done = !content || content.kind !== "question" || elapsed >= total;
  const waitMs = running && !done ? total - elapsed + 30 : null;
  useEffect(() => {
    if (waitMs == null) return;
    const id = window.setTimeout(() => setTick((n) => n + 1), waitMs);
    return () => window.clearTimeout(id);
    // Re-armed when the timeline changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, running, done]);
  return done;
}

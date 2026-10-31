import { useEffect, useState } from "react";
import { isMainTextItem, timerElapsed } from "@/game/contentPlan";
import { pointImage } from "@/lib/pointImage";
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
    content.plan.steps.some((step) =>
      step.items.some((item) => isMainTextItem(item, q?.textOrder, q?.textItems)),
    );
  const price = s.stakeQuestionData?.highestBid ?? q?.price ?? meta?.question.price ?? null;
  // Point answers: the player who answers now clicks the spot on the picture.
  const picture = pointPicture(q);
  const pointReady = usePointImageReady(session);
  const picking =
    !!picture &&
    pointReady &&
    (canAnswerNow(session, myId) ||
      (phase === "all_play_answering" &&
        role === "player" &&
        !!s.allPlay?.entries.some((entry) => entry.playerId === myId && entry.submitted)));

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
  };
}

/** Do not show a later answer image ahead of the running question timeline. */
export function usePointImageReady(session: GameSession): boolean {
  const [, tick] = useState(0);
  const { currentQuestion: q, isPaused } = session.state;
  const content = session.content;
  const image = pointImage(q?.questionFiles, q?.pointImageOrder);
  const step =
    image && content?.kind === "question"
      ? content.plan.steps.find((item) =>
          item.items.some((part) => part.kind === "file" && part.order === image.order),
        )
      : undefined;
  const running = content?.kind === "question" && content.timer && content.frozenAtMs == null;
  const elapsed = running ? timerElapsed(content.timer, isPaused) : 0;
  const wait = running && step ? Math.max(0, step.startMs - elapsed) : 0;
  useEffect(() => {
    if (!wait || isPaused) return;
    const id = window.setTimeout(() => tick((value) => value + 1), wait + 30);
    return () => window.clearTimeout(id);
  }, [wait, isPaused]);
  return wait === 0;
}

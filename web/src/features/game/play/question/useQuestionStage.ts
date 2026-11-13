import { getRealPrice } from "@/game/questionPrices";
import { useEffect, useState } from "react";
import { isMainTextItem, itemStart } from "@/game/contentPlan";
import { pointImage } from "@/lib/pointImage";
import { timerStartDelay } from "@/lib/timer";
import type { GameSession } from "@/game/reducer";
import {
  canAnswerNow,
  answerWindowOpensIn,
  pointPicture,
  myAllPlayEntry,
  boardQuestionMeta,
  myRole,
  phaseOf,
} from "@/game/selectors";
import { useGame, useGameState, useSession } from "../../GameContext";
import {
  contentElapsed,
  presentedQuestionContent,
  questionOpening,
} from "@/game/questionPresentation";

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
  const gated = phase === "media" && role !== "showman" && !s.questionTransition?.mediaReady;
  const { content, playing } = useQuestionContent(session);
  const showmanPreview = phase === "media" && role === "showman";
  // A sequenced text appears in its own step instead of under the media.
  const textIsStep =
    content?.kind === "question" &&
    content.plan.steps.some((step) =>
      step.items.some((item) => isMainTextItem(item, q?.textOrder, q?.textItems)),
    );
  const price = s.stakeQuestionData?.highestBid ?? getRealPrice(q) ?? meta?.question.price ?? null;
  const { picture, picking } = usePointPicking(session, myId);

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

function usePointPicking(session: GameSession, playerId: number) {
  const picture = pointPicture(session.state.currentQuestion);
  const imageReady = usePointImageReady(session);
  const answerWindowReady = useAnswerWindowReady(session);
  // Keep the submitted marker visible until everyone has finished answering.
  const submittedPoint =
    phaseOf(session) === "all_play_answering" &&
    myRole(session, playerId) === "player" &&
    myAllPlayEntry(session, playerId)?.submitted === true;
  const picking =
    !!picture &&
    imageReady &&
    answerWindowReady &&
    (canAnswerNow(session, playerId) || submittedPoint);
  return { picture, picking };
}

/** Do not show a later answer image ahead of the running question timeline. */
export function usePointImageReady(session: GameSession): boolean {
  const [, tick] = useState(0);
  const { currentQuestion: q, isPaused } = session.state;
  const { content } = useQuestionContent(session);
  const image = pointImage(q?.questionFiles, q?.pointImageOrder);
  const step =
    image && content?.kind === "question"
      ? content.plan.steps.find((item) =>
          item.items.some((part) => part.kind === "file" && part.order === image.order),
        )
      : undefined;
  const running = content?.kind === "question" && content.timer && content.frozenAtMs == null;
  const elapsed = content ? contentElapsed(content, isPaused) : 0;
  const item = step?.items.find((part) => part.kind === "file" && part.order === image?.order);
  const wait =
    item && step
      ? timerStartDelay(content?.timer) + Math.max(0, itemStart(item, step.startMs) - elapsed)
      : 0;
  useEffect(() => {
    if (!wait || isPaused || !running) return;
    const id = window.setTimeout(() => tick((value) => value + 1), wait + 30);
    return () => window.clearTimeout(id);
  }, [wait, isPaused, running]);
  return wait === 0;
}

/** Both the question view and point readiness use the same local presentation. */
function useQuestionContent(session: GameSession) {
  const presentation = useGameState((s) => s.questionPresentation);
  return {
    content: presentedQuestionContent(session, presentation),
    playing:
      phaseOf(session) === "showing" && !session.state.isPaused && !questionOpening(presentation),
  };
}

export function useAnswerWindowReady(session: GameSession): boolean {
  const [, tick] = useState(0);
  const wait = answerWindowOpensIn(session);
  useEffect(() => {
    if (!Number.isFinite(wait) || wait <= 0 || session.state.isPaused) return;
    const id = window.setTimeout(() => tick((value) => value + 1), wait + 1);
    return () => window.clearTimeout(id);
  }, [wait, session.state.isPaused]);
  return wait <= 0;
}

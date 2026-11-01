import { timerElapsed } from "./contentPlan";
import type { ContentClock, GameSession } from "./reducer";
import type { ServerEvent } from "./protocol";
import { phaseOf } from "./selectors";

export const QUESTION_PICK_TIMING = {
  fadeIn: 200,
  hold: 300,
  quietWait: 250,
  fadeOut: 300,
  hintFadeIn: 200,
  hintPulse: 2000,
} as const;
export const QUESTION_PICK_INTRO =
  QUESTION_PICK_TIMING.fadeIn + QUESTION_PICK_TIMING.hold + QUESTION_PICK_TIMING.quietWait;

/** Device-local presentation only; never changes the server's phase or timer. */
export interface QuestionPresentation {
  id: number;
  roundKey: string;
  questionId: number;
  theme: string;
  price: number | null;
  previousSession: GameSession | null;
  boardEdit: boolean;
  startedAt: number | null;
  introDone: boolean;
  hintVisible: boolean;
  revealStartedAt: number | null;
  complete: boolean;
  contentOffsetMs: number | null;
}

function roundKey(session: GameSession) {
  const round = session.state.currentRound;
  return round ? String(round.id ?? "") + ":" + round.order : "";
}

export function currentQuestionId(session: GameSession): number | undefined {
  const phase = phaseOf(session);
  if (phase === "choosing") return undefined;
  if (phase === "secret_transfer") return session.state.secretQuestionData?.questionId;
  if (phase === "stake_bidding") return session.state.stakeQuestionData?.questionId;
  return session.state.allPlay?.questionId ?? session.state.currentQuestion?.id;
}

export function newQuestionPresentation(
  before: GameSession | null,
  after: GameSession,
  event: ServerEvent | undefined,
  id: number,
  boardEdit: boolean,
): QuestionPresentation | null {
  if (
    !before ||
    !event ||
    event.type === "game-data" ||
    before.state.currentRound?.type !== "simple" ||
    roundKey(before) !== roundKey(after) ||
    phaseOf(before) !== "choosing" ||
    phaseOf(after) === "choosing"
  )
    return null;
  const questionId =
    event.type === "question-data"
      ? event.payload.data.id
      : event.type === "secret-question-picked" ||
          event.type === "stake-question-picked" ||
          event.type === "all-play-start"
        ? event.payload.questionId
        : undefined;
  for (const theme of before.state.currentRound.themes) {
    const question = theme.questions.find((q) => q.id === questionId);
    if (question)
      return {
        id,
        roundKey: roundKey(after),
        questionId: question.id,
        theme: theme.name,
        price: question.price ?? null,
        previousSession: before,
        boardEdit,
        startedAt: null,
        introDone: false,
        hintVisible: false,
        revealStartedAt: null,
        complete: false,
        contentOffsetMs: null,
      };
  }
  return null;
}

export function samePresentedQuestion(p: QuestionPresentation, session: GameSession) {
  return (
    !session.finished &&
    session.state.currentRound?.type === "simple" &&
    roundKey(session) === p.roundKey &&
    currentQuestionId(session) === p.questionId &&
    !["choosing", "reveal", "all_play_reviewing"].includes(phaseOf(session))
  );
}

export function questionOpening(p: QuestionPresentation | null | undefined) {
  return !!p && !p.complete;
}

export function contentElapsed(content: ContentClock, paused: boolean) {
  return Math.max(
    0,
    content.frozenAtMs ??
      (content.timer ? timerElapsed(content.timer, paused) : content.plan.totalMs),
  );
}

export function captureContentOffset(p: QuestionPresentation, session: GameSession) {
  return p.complete &&
    p.contentOffsetMs == null &&
    session.content?.kind === "question" &&
    session.state.currentQuestion?.id === p.questionId
    ? { ...p, contentOffsetMs: contentElapsed(session.content, session.state.isPaused) }
    : p;
}

/** One shifted clock for screen steps, foreground media and background tracks. */
export function presentedQuestionContent(
  session: GameSession,
  p: QuestionPresentation | null | undefined,
): ContentClock | null {
  const content = session.content;
  if (!p || !samePresentedQuestion(p, session) || content?.kind !== "question") return content;
  if (!p.complete) return { ...content, timer: null, frozenAtMs: 0 };
  const offset = p.contentOffsetMs ?? 0;
  if (!offset) return content;
  return {
    ...content,
    timer: content.timer ? { ...content.timer, elapsedMs: content.timer.elapsedMs - offset } : null,
    frozenAtMs: content.frozenAtMs == null ? null : Math.max(0, content.frozenAtMs - offset),
  };
}

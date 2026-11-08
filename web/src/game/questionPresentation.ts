import { timerElapsed } from "./contentPlan";
import type { ContentClock, GameSession } from "./reducer";
import type { QuestionType, ServerEvent } from "./protocol";
import { phaseOf } from "./selectors";

export const QUESTION_PICK_TIMING = {
  fadeIn: 200,
  hold: 800,
  quietWait: 250,
  fadeOut: 300,
  hintFadeIn: 200,
  hintPulse: 2000,
} as const;
export const QUESTION_PICK_INTRO =
  QUESTION_PICK_TIMING.fadeIn + QUESTION_PICK_TIMING.hold + QUESTION_PICK_TIMING.quietWait;
export const MEDIA_PLAYBACK_START_DELAY_MS =
  QUESTION_PICK_INTRO + QUESTION_PICK_TIMING.fadeOut + 200;
export const QUESTION_TRANSITION_MS = QUESTION_PICK_INTRO + QUESTION_PICK_TIMING.fadeOut;
export const QUESTION_CONTENT_START_LEAD_MS = 200;

/** Device-local presentation only; never changes the server's phase or timer. */
export interface QuestionPresentation {
  id: number;
  serverDriven?: boolean;
  roundKey: string;
  questionId: number;
  theme: string;
  type: QuestionType;
  price: number | null;
  previousSession: GameSession | null;
  boardEdit: boolean;
  startedAt: number | null;
  introDone: boolean;
  hintVisible: boolean;
  revealStartedAt: number | null;
  complete: boolean;
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
  const restoring =
    event?.type === "game-data" &&
    !!after.state.questionTransition &&
    after.state.questionState === "media_downloading";
  if (restoring) before = after;
  if (
    !before ||
    !event ||
    (!restoring && event.type === "game-data") ||
    before.state.currentRound?.type !== "simple" ||
    roundKey(before) !== roundKey(after) ||
    (!restoring && phaseOf(before) !== "choosing") ||
    phaseOf(after) === "choosing"
  )
    return null;
  const questionId = restoring
    ? after.state.currentQuestion?.id
    : event.type === "question-data"
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
        serverDriven: !!after.state.questionTransition,
        roundKey: roundKey(after),
        questionId: question.id,
        theme: theme.name,
        type: restoring
          ? after.state.currentQuestion!.type
          : event.type === "question-data"
            ? event.payload.data.type
            : event.type === "secret-question-picked"
              ? "secret"
              : event.type === "stake-question-picked"
                ? "stake"
                : after.state.allPlay?.mode === "stake"
                  ? "stake"
                  : "noRisk",
        price: question.price ?? null,
        previousSession: restoring ? null : before,
        boardEdit,
        startedAt: null,
        introDone: false,
        hintVisible: false,
        revealStartedAt: null,
        complete: false,
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

/** Keep the covered stage still. Uncover onto the shared clock, even on a late client. */
export function presentedQuestionContent(
  session: GameSession,
  p: QuestionPresentation | null | undefined,
): ContentClock | null {
  const content = session.content;
  if (!p || p.complete || !samePresentedQuestion(p, session) || content?.kind !== "question") {
    return content;
  }
  return { ...content, timer: null, frozenAtMs: 0 };
}

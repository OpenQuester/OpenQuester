import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  QUESTION_PICK_INTRO,
  QUESTION_PICK_TIMING,
  questionOpening,
  type QuestionPresentation,
} from "@/game/questionPresentation";
import { createGameStore } from "@/game/store";
import { formatScore } from "@/lib/format";
import { QuestionTypeBadge } from "./question/QuestionTypeBadge";
import { timerElapsed } from "@/game/contentPlan";
import { GameContext, useGame, useGameState, useGameStoreApi } from "../GameContext";
import { GameBoard } from "./GameBoard";
import "./QuestionPickTransition.css";

const timingStyle = {
  "--question-pick-in": QUESTION_PICK_TIMING.fadeIn + "ms",
  "--question-pick-out": QUESTION_PICK_TIMING.fadeOut + "ms",
  "--question-pick-hint-in": QUESTION_PICK_TIMING.hintFadeIn + "ms",
  "--question-pick-pulse": QUESTION_PICK_TIMING.hintPulse + "ms",
} as CSSProperties;

/** Shared by the live field and editor playtest; server state keeps advancing. */
export function QuestionPickTransition({ children }: { children: ReactNode }) {
  const presentation = useGameState((s) => s.questionPresentation);
  const opening = questionOpening(presentation);
  return (
    <div
      className="question-pick-stage relative flex min-h-0 flex-1 flex-col"
      data-opening={opening || undefined}
      style={timingStyle}
    >
      {(!opening || presentation?.revealStartedAt != null) && (
        <div className="contents" inert={opening}>
          {children}
        </div>
      )}
      {opening && presentation && (
        <QuestionOpening key={presentation.id} presentation={presentation} />
      )}
    </div>
  );
}

function QuestionOpening({ presentation: p }: { presentation: QuestionPresentation }) {
  const { t } = useTranslation();
  const store = useGameStoreApi();
  const ready = useGameState((s) => s.session?.state.questionState !== "media_downloading");
  const opening = useGameState((s) => s.session?.state.questionTransition);
  const paused = useGameState((s) => !!s.session?.state.isPaused);
  const { id, startedAt, introDone, revealStartedAt } = p;
  const overlay = useRef<HTMLElement>(null);
  const exiting = revealStartedAt != null;
  const [restored] = useState(p.previousSession == null);

  useLayoutEffect(() => {
    if (!p.serverDriven || !opening || !overlay.current) return;
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.motion === "reduced";
    if (reduced) return;
    const elapsed = timerElapsed(opening.timer, paused);
    const duration = exiting ? QUESTION_PICK_TIMING.fadeOut : QUESTION_PICK_TIMING.fadeIn;
    const animation = overlay.current.animate(
      [{ opacity: exiting ? 1 : 0 }, { opacity: exiting ? 0 : 1 }],
      { duration, easing: exiting ? "ease-in" : "ease-out", fill: "both" },
    );
    // A fresh pick starts visually at zero opacity. Its later boundaries still
    // follow the server; restored and resumed openings seek their existing fade.
    animation.currentTime =
      !exiting && !restored && !paused && !opening.timer.resumedAt && elapsed < duration
        ? 0
        : exiting
          ? Math.max(0, elapsed - opening.timer.durationMs + duration)
          : elapsed;
    if (paused) animation.pause();
    return () => animation.cancel();
  }, [opening, paused, p.serverDriven, exiting, restored]);

  useEffect(() => {
    if (!p.serverDriven) return;
    if (!opening) {
      store.getState().finishQuestionOpening(id);
      return;
    }
    const fadeAt = opening.timer.durationMs - QUESTION_PICK_TIMING.fadeOut;
    const sync = () => {
      const elapsed = timerElapsed(opening.timer, paused);
      const at = performance.now();
      store.getState().syncQuestionOpening(id, {
        startedAt: at - elapsed,
        introDone: elapsed >= QUESTION_PICK_INTRO,
        hintVisible: elapsed >= QUESTION_PICK_INTRO && !opening.mediaReady,
        revealStartedAt: opening.mediaReady && elapsed >= fadeAt ? at - (elapsed - fadeAt) : null,
        complete: !paused && opening.mediaReady && elapsed >= opening.timer.durationMs,
        ...(elapsed >= QUESTION_PICK_TIMING.fadeIn ? { previousSession: null } : {}),
      });
    };
    sync();
    if (paused) return;
    const elapsed = timerElapsed(opening.timer, false);
    const boundaries = [
      QUESTION_PICK_TIMING.fadeIn,
      QUESTION_PICK_INTRO,
      ...(opening.mediaReady ? [fadeAt, opening.timer.durationMs] : []),
    ];
    const timers = boundaries
      .filter((at) => at > elapsed)
      .map((at) => window.setTimeout(sync, at - elapsed));
    return () => timers.forEach(window.clearTimeout);
  }, [id, opening, paused, p.serverDriven, store]);

  useLayoutEffect(() => {
    if (p.serverDriven) return;
    if (startedAt != null) return;
    let second = 0;
    // Leave an actual paint opportunity at opacity zero, including batched re-picks.
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() =>
        store.getState().startQuestionOpening(id, performance.now()),
      );
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [id, startedAt, p.serverDriven, store]);

  useEffect(() => {
    if (p.serverDriven) return;
    if (startedAt == null) return;
    const cover = window.setTimeout(
      () => store.getState().coverQuestionBoard(id),
      Math.max(0, startedAt + QUESTION_PICK_TIMING.fadeIn - performance.now()),
    );
    const intro = window.setTimeout(
      () => store.getState().finishQuestionIntro(id),
      Math.max(0, startedAt + QUESTION_PICK_INTRO - performance.now()),
    );
    return () => {
      window.clearTimeout(cover);
      window.clearTimeout(intro);
    };
  }, [id, startedAt, p.serverDriven, store]);

  useEffect(() => {
    if (!p.serverDriven && introDone && ready && revealStartedAt == null)
      store.getState().revealQuestion(id, performance.now());
  }, [id, introDone, ready, revealStartedAt, p.serverDriven, store]);

  useEffect(() => {
    if (p.serverDriven) return;
    if (revealStartedAt == null) return;
    const timeout = window.setTimeout(
      () => store.getState().finishQuestionOpening(id),
      Math.max(0, revealStartedAt + QUESTION_PICK_TIMING.fadeOut - performance.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [id, revealStartedAt, p.serverDriven, store]);

  return (
    <>
      {p.previousSession && <PreviousBoard presentation={p} />}
      <section
        ref={overlay}
        className="question-pick-overlay"
        data-testid="question-pick-transition"
        data-attempt={id}
        data-started={startedAt != null || undefined}
        data-exiting={revealStartedAt != null || undefined}
        style={p.serverDriven ? { animationName: "none" } : undefined}
        role="status"
        aria-label={t("questionOpening.opening")}
      >
        <div className="question-pick-title">
          <QuestionTypeBadge type={p.type} />
          <h2>{p.theme}</h2>
          <span className="question-pick-price">
            {p.price == null ? "?" : formatScore(p.price)}
          </span>
        </div>
        {p.hintVisible && (
          <p className="question-pick-waiting" data-testid="question-pick-waiting">
            {t("questionOpening.waiting")}
          </p>
        )}
      </section>
    </>
  );
}

function PreviousBoard({ presentation: p }: { presentation: QuestionPresentation }) {
  const game = useGame();
  const [store] = useState(() => {
    const frozen = createGameStore();
    frozen.setState({
      session: p.previousSession,
      gameId: p.previousSession?.gameId ?? null,
      connection: "connected",
      boardEdit: p.boardEdit,
    });
    return frozen;
  });
  const context = useMemo(
    () => ({
      connection: game.connection,
      myId: game.myId,
      protectedFinalThemeId: game.protectedFinalThemeId,
      store,
    }),
    [game.connection, game.myId, game.protectedFinalThemeId, store],
  );
  return (
    <div className="absolute inset-0 flex min-h-0 flex-col" inert aria-hidden="true">
      <GameContext.Provider value={context}>
        <GameBoard />
      </GameContext.Provider>
    </div>
  );
}

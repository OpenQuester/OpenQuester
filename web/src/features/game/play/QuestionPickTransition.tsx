import {
  useEffect,
  useLayoutEffect,
  useMemo,
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
  const { id, startedAt, introDone, revealStartedAt } = p;

  useLayoutEffect(() => {
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
  }, [id, startedAt, store]);

  useEffect(() => {
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
  }, [id, startedAt, store]);

  useEffect(() => {
    if (introDone && ready && revealStartedAt == null)
      store.getState().revealQuestion(id, performance.now());
  }, [id, introDone, ready, revealStartedAt, store]);

  useEffect(() => {
    if (revealStartedAt == null) return;
    const timeout = window.setTimeout(
      () => store.getState().finishQuestionOpening(id),
      Math.max(0, revealStartedAt + QUESTION_PICK_TIMING.fadeOut - performance.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [id, revealStartedAt, store]);

  return (
    <>
      {p.previousSession && <PreviousBoard presentation={p} />}
      <section
        className="question-pick-overlay"
        data-testid="question-pick-transition"
        data-attempt={id}
        data-started={startedAt != null || undefined}
        data-exiting={revealStartedAt != null || undefined}
        role="status"
        aria-label={t("questionOpening.opening")}
      >
        <div className="question-pick-title">
          <h2>{p.theme}</h2>
          <span>{p.price == null ? "?" : formatScore(p.price)}</span>
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

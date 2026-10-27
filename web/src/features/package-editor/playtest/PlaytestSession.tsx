import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { GameContext } from "@/features/game/GameContext";
import { GameActionDock } from "@/features/game/play/GameActionDock";
import { GameStage } from "@/features/game/play/GameStage";
import { PlayerChips } from "@/features/game/play/PlayerChips";
import { pointAnswer, type Spot } from "@/features/game/play/PointPicker";
import { useSettings } from "@/features/settings/settingsStore";
import { nextChangeAt, timerElapsed } from "@/game/contentPlan";
import type { Question } from "@/game/protocol";
import type { GameSession } from "@/game/reducer";
import { canBuzz, phaseOf, pointPicture } from "@/game/selectors";
import { PlaytestControls } from "./PlaytestControls";
import { PREVIEW_FINAL_THEME, PREVIEW_PLAYERS, PREVIEW_SHOWMAN } from "./previewModel";
import { previewTimer, PreviewRuntime } from "./previewRuntime";
import { onPlaytestKey } from "./playtestKeyboard";

export function PlaytestSession({
  initial,
  question,
  credits,
  legacy,
  onRestart,
}: {
  initial: GameSession;
  question: Question;
  credits: { authors: string[]; sources: string[] };
  legacy: boolean;
  onRestart: () => void;
}) {
  const { t } = useTranslation();
  const [game] = useState(() => {
    const start = structuredClone(initial);
    if (start.state.timer) start.state.timer = previewTimer(start.state.timer.durationMs);
    const result = new PreviewRuntime(start, structuredClone(question), credits);
    result.store.setState({ previewVolume: useSettings.getState().volume });
    return result;
  });
  const [perspective, setPerspective] = useState<number>(PREVIEW_PLAYERS[0]);
  const [actor, setActor] = useState<number>(PREVIEW_PLAYERS[0]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [points, setPoints] = useState<Record<number, Spot>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const session = useStore(game.store, (state) => state.session!);
  const phase = phaseOf(session);
  useEffect(() => {
    game.activate();
    return () => game.dispose();
  }, [game]);
  useEffect(() => {
    const timer = game.activeTimer;
    if (!timer || session.state.isPaused) return;
    const left = Math.max(0, timer.durationMs - timerElapsed(timer, false));
    const version = session.version;
    const id = window.setTimeout(() => {
      if (game.session.version === version) game.timeout();
    }, left);
    return () => window.clearTimeout(id);
  }, [game, session.version, session.state.isPaused]);
  const type = question.type === "choice" ? "choice" : (question.answerType ?? "text");
  const value = answers[actor] ?? (type === "text" ? t("editor.playtest.testAnswer") : "");
  const setValue = (answer: string) => setAnswers((old) => ({ ...old, [actor]: answer }));
  const actorSubmitted =
    phase === "all_play_answering"
      ? session.state.allPlay?.entries.some((entry) => entry.playerId === actor && entry.submitted)
      : phase === "final_answering" && session.finalSubmitted.includes(actor);
  const needsAnswer =
    phase === "answering" || phase === "all_play_answering" || phase === "final_answering";
  const waitingForJudge = phase === "answering" && game.session.submittedAnswer != null;
  const actorMismatch = phase === "answering" && session.state.answeringPlayer !== actor;
  const reviewWaiting =
    phase === "all_play_reviewing"
      ? session.state.allPlay?.entries.some((entry) => entry.isCorrect == null)
      : phase === "final_reviewing" &&
        session.state.finalRoundData?.answers.some(
          (answer) => answer.isCorrect == null && !answer.autoLoss,
        );
  const finished = phase === "finished";
  const availability = canBuzz(game.session, actor);
  const elapsed = timerElapsed(session.state.timer, session.state.isPaused);
  const waitAvailable =
    phase === "showing" &&
    ((session.state.buzzerOpensAtMs ?? 0) > elapsed ||
      (session.content?.kind === "question" &&
        nextChangeAt(session.content.plan, elapsed) != null));
  const actorUnavailable = phase === "showing" && !availability.ok;
  return (
    <GameContext.Provider
      value={{
        connection: game.commands,
        myId: perspective,
        store: game.store,
        protectedFinalThemeId: PREVIEW_FINAL_THEME,
      }}
    >
      <div
        className="flex min-h-full flex-col gap-4 p-4 sm:p-5"
        data-testid="question-playtest"
        tabIndex={-1}
        onKeyDown={(event) => onPlaytestKey(event, game, perspective)}
      >
        <p className="m-0 text-sm text-muted">{t("editor.playtest.local")}</p>
        {legacy && <p className="m-0 text-sm text-muted">{t("editor.playtest.legacy")}</p>}
        <PlaytestControls
          perspective={perspective}
          actor={actor}
          answerType={type}
          value={value}
          options={question.answers ?? []}
          picture={pointPicture(question)}
          picked={points[actor] ?? null}
          showPoint={needsAnswer}
          settingsOpen={settingsOpen}
          paused={session.state.isPaused}
          finished={finished}
          canContinue={
            !session.state.isPaused &&
            !finished &&
            !actorSubmitted &&
            !waitingForJudge &&
            !actorMismatch &&
            !reviewWaiting &&
            (!actorUnavailable || waitAvailable) &&
            (!needsAnswer || !!value.trim())
          }
          canBuzz={!session.state.isPaused && phase === "showing" && availability.ok}
          onPerspective={(id) => {
            setPerspective(id);
            game.setPerspective(id);
          }}
          onActor={(id) => {
            setActor(id);
            game.setActor(id);
          }}
          onAnswer={setValue}
          onPoint={(spot) => {
            setPoints((old) => ({ ...old, [actor]: spot }));
            setValue(pointAnswer(spot));
          }}
          onToggleSettings={() => setSettingsOpen((open) => !open)}
          onContinue={() => game.advance(value)}
          onBuzz={() => game.buzz(actor)}
          onPause={() => game.pause(!session.state.isPaused)}
          onRestart={onRestart}
        />
        {actorSubmitted && (
          <p className="m-0 text-sm text-muted">{t("editor.playtest.alreadySubmitted")}</p>
        )}
        {actorMismatch && !waitingForJudge && (
          <p className="m-0 text-sm text-muted">{t("editor.playtest.selectAnswerer")}</p>
        )}
        {(waitingForJudge || reviewWaiting) && (
          <p className="m-0 text-sm text-muted">
            {t(
              perspective === PREVIEW_SHOWMAN
                ? "editor.playtest.judgeAnswers"
                : "editor.playtest.switchToShowman",
            )}
          </p>
        )}
        {actorUnavailable && !availability.ok && (
          <p className="m-0 text-sm text-muted">{t(`reasons.${availability.reason}`)}</p>
        )}
        {finished && <p className="m-0 text-sm text-muted">{t("editor.playtest.finished")}</p>}
        <div className="shrink-0">
          <PlayerChips />
        </div>
        <div className="order-2 flex min-h-52 shrink-0 flex-col rounded-md border border-line bg-surface-2 p-3 sm:order-1 sm:grow sm:p-5">
          <GameStage />
        </div>
        <div className="order-1 shrink-0 sm:order-2">
          <GameActionDock />
        </div>
      </div>
    </GameContext.Provider>
  );
}

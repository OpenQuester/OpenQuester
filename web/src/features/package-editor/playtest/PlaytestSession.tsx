import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { GameContext } from "@/features/game/GameContext";
import { GameActionDock } from "@/features/game/play/GameActionDock";
import { GameStage } from "@/features/game/play/GameStage";
import { PlayerChips } from "@/features/game/play/PlayerChips";
import { useSettings } from "@/features/settings/settingsStore";
import { timerElapsed } from "@/game/contentPlan";
import type { Question } from "@/game/protocol";
import type { GameSession } from "@/game/reducer";
import { canManuallyJudge, phaseOf } from "@/game/selectors";
import { PlaytestControls } from "./PlaytestControls";
import { PREVIEW_FINAL_THEME, PREVIEW_PLAYERS, PREVIEW_SHOWMAN } from "./previewModel";
import { previewTimer, PreviewRuntime } from "./previewRuntime";
import { onPlaytestKey } from "./playtestKeyboard";
import { needsPlayerPerspective } from "./playtestGuidance";
import { usePlaytestWait } from "./usePlaytestWait";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const session = useStore(game.store, (state) => state.session!);
  const phase = phaseOf(session);
  useEffect(() => {
    game.activate();
    if (phaseOf(game.session) === "choosing") game.pick();
    return () => game.dispose();
  }, [game]);
  useEffect(() => {
    if (phase === "media" && !session.state.isPaused) game.ready();
  }, [game, phase, session.state.isPaused]);
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
  const waitingForJudge = canManuallyJudge(game.session) && game.session.hasAnswerSubmission;
  const reviewWaiting =
    phase === "all_play_reviewing"
      ? session.state.allPlay?.entries.some((entry) => entry.isCorrect == null)
      : phase === "final_reviewing" &&
        session.state.finalRoundData?.answers.some(
          (answer) => answer.isCorrect == null && !answer.autoLoss,
        );
  const needsPlayer = needsPlayerPerspective(game.session, perspective);
  const finished = phase === "finished";
  const waitAvailable = usePlaytestWait(session);
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <PlayerChips />
          </div>
          <PlaytestControls
            perspective={perspective}
            settingsOpen={settingsOpen}
            paused={session.state.isPaused}
            finished={finished}
            canContinue={
              !session.state.isPaused &&
              (phase === "choosing" || phase === "media" || phase === "reveal" || waitAvailable)
            }
            onPerspective={(id) => {
              setPerspective(id);
              game.setPerspective(id);
            }}
            onToggleSettings={() => setSettingsOpen((open) => !open)}
            onContinue={() => game.advance()}
            onPause={() => game.pause(!session.state.isPaused)}
            onRestart={onRestart}
          />
        </div>
        {legacy && <p className="m-0 text-sm text-muted">{t("editor.playtest.legacy")}</p>}
        {(waitingForJudge || reviewWaiting) && (
          <p className="m-0 text-sm text-muted">
            {t(
              perspective === PREVIEW_SHOWMAN
                ? "editor.playtest.judgeAnswers"
                : "editor.playtest.switchToShowman",
            )}
          </p>
        )}
        {needsPlayer && (
          <p className="m-0 text-sm text-muted">{t("editor.playtest.switchToPlayer")}</p>
        )}
        {finished && <p className="m-0 text-sm text-muted">{t("editor.playtest.finished")}</p>}
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

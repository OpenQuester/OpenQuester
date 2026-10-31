import { gameScreenStyles, gameWidth } from "./screen/gameScreenStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { ReportQuestionDialog } from "@/features/stats/QuestionReporting";
import { seatedPlayers } from "@/game/selectors";
import { cn } from "@/lib/cn";
import { ConnectionBanner } from "./ConnectionBanner";
import { GameActionDock } from "./GameActionDock";
import { GameMenu } from "./GameMenu";
import { GamePauseOverlay } from "./GamePauseOverlay";
import { GameStage } from "./GameStage";
import { GameHeader } from "./screen/GameHeader";
import { GamePanels } from "./screen/GamePanels";
import { useGameScreen } from "./screen/useGameScreen";
import "./question/QuestionLayout.css";

/** Persistent game layout: header, stage, action dock and responsive panels. */
export function GameScreen() {
  const { t } = useTranslation();
  const game = useGameScreen();
  const { session, role, phase, announcement, menuOpen, setMenuOpen, setPanel } = game;

  return (
    <div
      className="game-screen flex h-dvh overflow-hidden bg-bg"
      data-phase={phase}
      data-role={role}
    >
      <div className={layoutStyles.contentColumn}>
        <p className="sr-only" aria-live="polite" role="status">
          {announcement}
        </p>
        <ConnectionBanner />
        <GameHeader game={game} />

        <main className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={cn(gameWidth, gameScreenStyles.stage)}
            inert={session.state.isPaused}
            data-testid="game-stage"
          >
            <GameStage />
          </div>
          {session.state.isPaused && <GamePauseOverlay isShowman={role === "showman"} />}
        </main>

        <GameActionDock />
      </div>
      <GamePanels game={game} />
      <ReportQuestionDialog gameId={session.gameId} />
      <GameMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        onHostTools={() => setPanel("host", true)}
      />
      {seatedPlayers(session).length === 0 && role === "showman" && phase === "choosing" && (
        <span className="sr-only">{t("game.noPlayers")}</span>
      )}
    </div>
  );
}

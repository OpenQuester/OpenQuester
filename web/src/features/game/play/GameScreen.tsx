import { gameScreenStyles, gameWidth } from "./screen/gameScreenStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { ReportQuestionDialog } from "@/features/stats/QuestionReporting";
import { seatedPlayers } from "@/game/selectors";
import { cn } from "@/lib/cn";
import { ConnectionBanner } from "./ConnectionBanner";
import { GameActionDock } from "./GameActionDock";
import { GameMenu } from "./GameMenu";
import { GameStage } from "./GameStage";
import { GameHeader } from "./screen/GameHeader";
import { GamePanels } from "./screen/GamePanels";
import { useGameScreen } from "./screen/useGameScreen";

/** Persistent game layout: header, stage, action dock and responsive panels. */
export function GameScreen() {
  const { t } = useTranslation();
  const game = useGameScreen();
  const { session, role, phase, announcement, menuOpen, setMenuOpen, setPanel } = game;

  return (
    <div className="flex min-h-dvh bg-bg" data-phase={phase} data-role={role}>
      <div className={layoutStyles.contentColumn}>
        <p className="sr-only" aria-live="polite" role="status">
          {announcement}
        </p>
        <ConnectionBanner showPause />
        <GameHeader game={game} />

        <main
          className={cn(gameWidth, gameScreenStyles.stage, session.state.isPaused && "opacity-40")}
        >
          <GameStage />
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

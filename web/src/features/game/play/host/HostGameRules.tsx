import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameSettings } from "@/api/types";
import { GameRulesFields } from "@/features/create-game/GameRules";
import { Button } from "@/ui/Button";
import { useGameState, useLiveGame, useSession } from "../../GameContext";
import { gamePanelStyles } from "../gamePanelStyles";
import { fullGameSettings, gameSettingsChange } from "./gameRulesDraft";

/**
 * The showman changes the rules mid-game with the create-game controls. The
 * form is keyed by the server's settings, so a change from the server resets
 * the draft while the section stays open.
 */
export function HostGameRules() {
  const { t } = useTranslation();
  const session = useSession();
  const current = fullGameSettings(session.settings);
  return (
    <details className={gamePanelStyles.hostForm} data-testid="host-rules">
      <summary className={gamePanelStyles.hostFormSummary}>{t("menu.rules.title")}</summary>
      <GameRulesForm key={JSON.stringify(current)} current={current} />
    </details>
  );
}

function GameRulesForm({ current }: { current: GameSettings }) {
  const { t } = useTranslation();
  const { connection } = useLiveGame();
  const sending = useGameState((s) => s.pending?.action === "game-settings-change");
  const [draft, setDraft] = useState(current);
  const change = gameSettingsChange(current, draft);
  return (
    <form
      className={gamePanelStyles.hostFormBody}
      onSubmit={(e) => {
        e.preventDefault();
        if (change) connection.emit("game-settings-change", change);
      }}
    >
      <p className="m-0 text-sm text-muted">{t("menu.rules.help")}</p>
      <GameRulesFields value={draft} onChange={setDraft} idPrefix="host-rules" />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="accent" disabled={!change || sending}>
          {sending ? t("menu.rules.saving") : t("menu.rules.save")}
        </Button>
        {change && (
          <Button type="button" variant="ghost" onClick={() => setDraft(current)}>
            {t("menu.rules.reset")}
          </Button>
        )}
      </div>
    </form>
  );
}

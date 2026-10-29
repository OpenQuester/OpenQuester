import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { inputClass } from "@/ui/Field";
import { PREVIEW_PLAYERS, PREVIEW_SHOWMAN, PREVIEW_SPECTATORS } from "./previewModel";

interface Props {
  perspective: number;
  settingsOpen: boolean;
  paused: boolean;
  canContinue: boolean;
  finished: boolean;
  onPerspective: (id: number) => void;
  onToggleSettings: () => void;
  onContinue: () => void;
  onPause: () => void;
  onRestart: () => void;
}

export function PlaytestControls(props: Props) {
  const { t } = useTranslation();
  const { perspective, settingsOpen, paused, canContinue, finished } = props;
  return (
    <>
      <div
        className="flex flex-wrap items-center justify-end gap-2"
        role="group"
        aria-label={t("editor.playtest.controls")}
      >
        <Button
          className="sm:hidden"
          aria-expanded={settingsOpen}
          aria-controls="playtest-settings"
          onClick={props.onToggleSettings}
        >
          {t("editor.playtest.settings")}
        </Button>
        <div
          id="playtest-settings"
          className={cn("flex-wrap gap-4", settingsOpen ? "flex" : "hidden sm:flex")}
        >
          <label className="flex items-center gap-2 whitespace-nowrap text-sm">
            {t("editor.playtest.perspective")}
            <select
              className={inputClass}
              value={perspective}
              onChange={(e) => props.onPerspective(Number(e.target.value))}
            >
              {PREVIEW_PLAYERS.map((id, index) => (
                <option key={id} value={id}>
                  {t("editor.playtest.player", { number: index + 1 })}
                </option>
              ))}
              <option value={PREVIEW_SHOWMAN}>{t("editor.playtest.showman")}</option>
              <option value={PREVIEW_SPECTATORS[0]}>{t("editor.playtest.spectator")}</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button onClick={props.onContinue} disabled={!canContinue}>
            {t("editor.playtest.continue")}
          </Button>
          <Button onClick={props.onPause} disabled={finished}>
            {t(paused ? "editor.playtest.resume" : "editor.playtest.pause")}
          </Button>
          <Button onClick={props.onRestart}>{t("editor.playtest.restart")}</Button>
        </div>
      </div>
    </>
  );
}

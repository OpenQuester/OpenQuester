import { useTranslation } from "react-i18next";
import { PointPicker, type Spot } from "@/features/game/play/PointPicker";
import { optionAnswer } from "@/features/game/play/question/useAnswerChoices";
import type { ChoiceAnswer } from "@/game/protocol";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { inputClass } from "@/ui/Field";
import { PREVIEW_PLAYERS, PREVIEW_SHOWMAN, PREVIEW_SPECTATORS } from "./previewModel";

interface Props {
  perspective: number;
  actor: number;
  answerType: "text" | "number" | "point" | "choice";
  value: string;
  options: ChoiceAnswer[];
  picture: string | null;
  picked: Spot | null;
  showPoint: boolean;
  settingsOpen: boolean;
  paused: boolean;
  canContinue: boolean;
  canBuzz: boolean;
  finished: boolean;
  onPerspective: (id: number) => void;
  onActor: (id: number) => void;
  onAnswer: (value: string) => void;
  onPoint: (point: Spot) => void;
  onToggleSettings: () => void;
  onContinue: () => void;
  onBuzz: () => void;
  onPause: () => void;
  onRestart: () => void;
}

export function PlaytestControls(props: Props) {
  const { t } = useTranslation();
  const {
    perspective,
    actor,
    answerType,
    value,
    options,
    picture,
    picked,
    showPoint,
    settingsOpen,
    paused,
    canContinue,
    canBuzz,
    finished,
  } = props;
  return (
    <>
      <div className="flex flex-wrap gap-4" role="group" aria-label={t("editor.playtest.controls")}>
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
          <label className="flex flex-col gap-1 text-sm">
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
          <label className="flex flex-col gap-1 text-sm">
            {t("editor.playtest.actor")}
            <select
              className={inputClass}
              value={actor}
              onChange={(e) => props.onActor(Number(e.target.value))}
            >
              {PREVIEW_PLAYERS.map((id, index) => (
                <option key={id} value={id}>
                  {t("editor.playtest.player", { number: index + 1 })}
                </option>
              ))}
            </select>
          </label>
          {answerType === "choice" ? (
            <label className="flex flex-col gap-1 text-sm">
              {t("editor.playtest.selectAnswer")}
              <select
                className={inputClass}
                value={value}
                onChange={(e) => props.onAnswer(e.target.value)}
              >
                <option value="">{t("editor.playtest.noOption")}</option>
                {options.map((option, index) => (
                  <option key={index} value={optionAnswer(option.text, index, options)}>
                    {option.text || t("question.optionNumber", { n: index + 1 })}
                  </option>
                ))}
              </select>
            </label>
          ) : answerType !== "point" ? (
            <label className="flex flex-col gap-1 text-sm">
              {t("editor.playtest.answer")}
              <input
                className={inputClass}
                value={value}
                inputMode={answerType === "number" ? "decimal" : undefined}
                onChange={(e) => props.onAnswer(e.target.value)}
                maxLength={255}
              />
            </label>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button onClick={props.onContinue} disabled={!canContinue}>
            {t("editor.playtest.continue")}
          </Button>
          <Button onClick={props.onBuzz} disabled={!canBuzz}>
            {t("editor.playtest.makeAnswer")}
          </Button>
          <Button onClick={props.onPause} disabled={finished}>
            {t(paused ? "editor.playtest.resume" : "editor.playtest.pause")}
          </Button>
          <Button onClick={props.onRestart}>{t("editor.playtest.restart")}</Button>
        </div>
      </div>
      {answerType === "point" && picture && showPoint && (
        <div className={cn("flex-col gap-2", settingsOpen ? "flex" : "hidden sm:flex")}>
          <p className="m-0 text-sm">{t("editor.playtest.point")}</p>
          <PointPicker src={picture} picked={picked} onPick={props.onPoint} className="max-w-sm" />
        </div>
      )}
    </>
  );
}

import { useTranslation } from "react-i18next";

import type { ButtonPressMode, GameSettings, GameTimerSettings } from "@/api/types";
import { cn } from "@/lib/cn";
import { Label, Select } from "@/ui/Field";

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  falseStart: true,
  buttonPressMode: "random_within_window",
  wrongAnswerPenalty: "subtract",
  timers: {
    answerMs: 20_500,
    answerSubmitMs: 60_000,
    stakeMs: 30_000,
    secretTransferMs: 30_000,
    allPlayAnswerMs: 45_000,
    finalAnswerMs: 75_000,
    roundMs: 0,
  },
};

/** Seconds each timer can be set to; the server accepts any value in range. */
const TIMER_CHOICES: Record<Exclude<keyof GameTimerSettings, "roundMs">, number[]> = {
  answerMs: [5, 10, 15, 20.5, 30, 45, 60],
  answerSubmitMs: [10, 20, 30, 45, 60, 90, 120],
  stakeMs: [10, 20, 30, 45, 60],
  secretTransferMs: [10, 20, 30, 45, 60],
  allPlayAnswerMs: [20, 30, 45, 60, 90, 120],
  finalAnswerMs: [30, 45, 60, 75, 90, 120, 180],
};

const ROUND_MINUTES = [0, 10, 15, 20, 30, 45, 60];

const PRESS_MODES: ButtonPressMode[] = ["random_within_window", "first_wins"];

/** The rules section of the create-game form. */
export function GameRules({
  value,
  onChange,
}: {
  value: GameSettings;
  onChange: (next: GameSettings) => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby="g-rules"
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6"
    >
      <h2 id="g-rules" className="m-0 text-lg font-bold">
        {t("create.rules.title")}
      </h2>
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          checked={value.falseStart}
          onChange={(e) => onChange({ ...value, falseStart: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--oq-accent)]"
        />
        <span className="flex flex-col gap-1">
          <span className="font-semibold">{t("create.rules.falseStart")}</span>
          <span className="text-sm text-muted">{t("create.rules.falseStartHelp")}</span>
        </span>
      </label>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-[15px] font-semibold">{t("create.rules.pressMode")}</legend>
        <div role="radiogroup" aria-label={t("create.rules.pressMode")} className="flex gap-2">
          {PRESS_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={value.buttonPressMode === mode}
              onClick={() => onChange({ ...value, buttonPressMode: mode })}
              className={cn(
                "min-h-12 flex-1 rounded-[12px] px-3 text-[15px] font-semibold text-text",
                value.buttonPressMode === mode
                  ? "border-2 border-accent bg-accent-surface"
                  : "border border-line-strong",
              )}
            >
              {t(`create.rules.modes.${mode}`)}
            </button>
          ))}
        </div>
        <p className="m-0 text-sm text-muted">
          {t(`create.rules.modeHelp.${value.buttonPressMode}`)}
        </p>
      </fieldset>
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          checked={value.wrongAnswerPenalty === "subtract"}
          onChange={(e) =>
            onChange({ ...value, wrongAnswerPenalty: e.target.checked ? "subtract" : "none" })
          }
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--oq-accent)]"
        />
        <span className="flex flex-col gap-1">
          <span className="font-semibold">{t("create.rules.penalty")}</span>
          <span className="text-sm text-muted">{t("create.rules.penaltyHelp")}</span>
        </span>
      </label>
      <div className="flex flex-col gap-2">
        <Label htmlFor="g-round">{t("create.rules.roundLimit")}</Label>
        <Select
          id="g-round"
          value={value.timers.roundMs / 60_000}
          onChange={(e) =>
            onChange({
              ...value,
              timers: { ...value.timers, roundMs: Number(e.target.value) * 60_000 },
            })
          }
        >
          {ROUND_MINUTES.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? t("create.rules.noLimit") : t("create.rules.minutes", { count: m })}
            </option>
          ))}
        </Select>
        <p className="m-0 text-sm text-muted">{t("create.rules.roundLimitHelp")}</p>
      </div>
      <details className="rounded-md border border-line p-4">
        <summary className="cursor-pointer font-semibold">{t("create.rules.timers")}</summary>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(Object.keys(TIMER_CHOICES) as (keyof typeof TIMER_CHOICES)[]).map((key) => (
            <div key={key} className="flex flex-col gap-2">
              <Label htmlFor={`g-timer-${key}`}>{t(`create.rules.timer.${key}`)}</Label>
              <Select
                id={`g-timer-${key}`}
                value={value.timers[key] / 1000}
                onChange={(e) =>
                  onChange({
                    ...value,
                    timers: { ...value.timers, [key]: Math.round(Number(e.target.value) * 1000) },
                  })
                }
              >
                {TIMER_CHOICES[key].map((sec) => (
                  <option key={sec} value={sec}>
                    {t("create.rules.seconds", { count: sec })}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

import { useTranslation } from "react-i18next";
import type { GameSettings } from "@/api/types";
import { Label, Select } from "@/ui/Field";
import { ROUND_MINUTES, TIMER_CHOICES } from "./gameSettings";
import { createGameStyles } from "./createGameStyles";

export function GameTimers({
  value,
  onChange,
}: {
  value: GameSettings;
  onChange: (next: GameSettings) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className={createGameStyles.field}>
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
            <div key={key} className={createGameStyles.field}>
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
    </>
  );
}

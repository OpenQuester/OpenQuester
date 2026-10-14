import { useTranslation } from "react-i18next";

import type { ButtonPressMode, GameSettings } from "@/api/types";
import { cn } from "@/lib/cn";

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  falseStart: true,
  buttonPressMode: "random_within_window",
};

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
    </section>
  );
}

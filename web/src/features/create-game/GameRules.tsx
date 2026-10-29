import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import type { GameSettings } from "@/api/types";
import { RadioButton } from "@/ui/RadioButton";
import { PRESS_MODES } from "./gameSettings";
import { GameTimers } from "./GameTimers";
import { createGameStyles } from "./createGameStyles";

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
    <section aria-labelledby="g-rules" className={createGameStyles.section}>
      <h2 id="g-rules" className="m-0 text-lg font-bold">
        {t("create.rules.title")}
      </h2>
      <GameRulesFields value={value} onChange={onChange} />
    </section>
  );
}

/** Rule and timer controls, shared by game creation and the showman's tools. */
export function GameRulesFields({
  value,
  onChange,
  idPrefix = "g",
}: {
  value: GameSettings;
  onChange: (next: GameSettings) => void;
  /** Keeps control ids unique when both forms could be on one page. */
  idPrefix?: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <RuleToggle
        checked={value.falseStart}
        onChange={(checked) => onChange({ ...value, falseStart: checked })}
        label={t("create.rules.falseStart")}
        help={t("create.rules.falseStartHelp")}
      />
      <fieldset className={layoutStyles.optionGroup}>
        <legend className="mb-2 text-[15px] font-semibold">{t("create.rules.pressMode")}</legend>
        <div role="radiogroup" aria-label={t("create.rules.pressMode")} className="flex gap-2">
          {PRESS_MODES.map((mode) => (
            <RadioButton
              key={mode}
              checked={value.buttonPressMode === mode}
              onClick={() => onChange({ ...value, buttonPressMode: mode })}
            >
              {t(`create.rules.modes.${mode}`)}
            </RadioButton>
          ))}
        </div>
        <p className="m-0 text-sm text-muted">
          {t(`create.rules.modeHelp.${value.buttonPressMode}`)}
        </p>
      </fieldset>
      <RuleToggle
        checked={value.wrongAnswerPenalty === "subtract"}
        onChange={(checked) =>
          onChange({ ...value, wrongAnswerPenalty: checked ? "subtract" : "none" })
        }
        label={t("create.rules.penalty")}
        help={t("create.rules.penaltyHelp")}
      />
      <GameTimers value={value} onChange={onChange} idPrefix={idPrefix} />
    </>
  );
}

function RuleToggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={createGameStyles.ruleCheckbox}
      />
      <span className="flex flex-col gap-1">
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-muted">{help}</span>
      </span>
    </label>
  );
}

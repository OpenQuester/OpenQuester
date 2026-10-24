import { questionFormStyles } from "./questionFormStyles";
import { useTranslation } from "react-i18next";
import type { QuestionFieldsProps } from "./questionUpdates";
import type { DraftQuestion } from "../packageDraft";
import { FieldError, inputClass, Label } from "@/ui/Field";
import { PointPicker } from "@/features/game/play/PointPicker";
import { mediaUrl } from "../packageMedia";
import { useMediaFile } from "../packageEditorStore";
import { QuestionCheckbox, NumberField, PricesField, SecondsField } from "./QuestionFields";
export function QuestionTypeSettings({ q, set, final }: QuestionFieldsProps & { final: boolean }) {
  const { t } = useTranslation();
  const type = final ? "simple" : q.type;
  return (
    <div className="flex flex-col gap-4">
      {type !== "simple" && type !== "hidden" && (
        <span className={questionFormStyles.typeLabel}>
          {t("editor.form.settingsFor", { type: t(`questionTypes.${type}`) })}
        </span>
      )}
      {type === "stake" && (
        <>
          <NumberField
            id="qf-max"
            integer
            label={t("editor.form.maxBid")}
            value={q.maxPrice}
            help={t("editor.form.maxBidHelp")}
            onChange={(maxPrice) => set({ maxPrice })}
          />
          <QuestionCheckbox
            checked={q.forEveryone}
            onChange={(forEveryone) => set({ forEveryone })}
            label={t("editor.form.stakeEveryone")}
          />
        </>
      )}
      {type === "noRisk" && (
        <>
          <NumberField
            id="qf-mult"
            label={t("editor.form.multiplier")}
            value={q.priceMultiplier}
            onChange={(v) => set({ priceMultiplier: v ?? 1 })}
          />
          <QuestionCheckbox
            checked={q.forEveryone}
            onChange={(forEveryone) => set({ forEveryone })}
            label={t("editor.form.noRiskEveryone")}
          />
        </>
      )}
      {type === "secret" && (
        <>
          <fieldset className={questionFormStyles.answerMode}>
            <legend className="mb-1.5 text-[15px] font-semibold">
              {t("editor.form.transferTitle")}
            </legend>
            {(["any", "exceptCurrent"] as const).map((v) => (
              <label key={v} className="flex min-h-10 items-center gap-2.5">
                <input
                  type="radio"
                  name="qf-transfer"
                  checked={q.transferType === v}
                  onChange={() => set({ transferType: v })}
                />
                {t(`editor.form.transfer.${v}`)}
              </label>
            ))}
          </fieldset>
          <PricesField
            value={q.allowedPrices}
            onChange={(allowedPrices) => set({ allowedPrices })}
          />
        </>
      )}
      {type === "choice" && (
        <SecondsField
          id="qf-showdelay"
          label={t("editor.form.showDelay")}
          ms={q.showDelay}
          onChange={(showDelay) => set({ showDelay })}
        />
      )}
      {type !== "choice" && !final && <AnswerCheckSettings q={q} set={set} />}
      <span className={questionFormStyles.previewLabel}>{t("editor.form.timing")}</span>
      {/* No "answer window" here: games time answers with the game's own timer
          settings, so a per-question value would have no effect */}
      <div className="grid grid-cols-2 gap-3">
        <SecondsField
          id="qf-reveal"
          label={t("editor.form.showAnswer")}
          ms={q.showAnswerDuration}
          onChange={(showAnswerDuration) => set({ showAnswerDuration })}
        />
      </div>
    </div>
  );
}

/** Typed, numeric, or point answers. */
export function AnswerCheckSettings({ q, set }: QuestionFieldsProps) {
  const { t } = useTranslation();
  const image = q.questionFiles.find((f) => f.type === "image");
  const file = useMediaFile(image?.md5);
  const src = mediaUrl(file);
  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor="qf-answer-type">{t("editor.form.answerType")}</Label>
      <select
        id="qf-answer-type"
        value={q.answerType}
        onChange={(e) =>
          set({ answerType: e.target.value as DraftQuestion["answerType"], answerDeviation: null })
        }
        className={inputClass}
      >
        {(["text", "number", "point"] as const).map((v) => (
          <option key={v} value={v}>
            {t(`editor.form.answerTypes.${v}`)}
          </option>
        ))}
      </select>
      {q.answerType === "number" && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id="qf-number"
            label={t("editor.form.answerNumber")}
            value={q.answerNumber}
            onChange={(answerNumber) => set({ answerNumber })}
            error={q.answerNumber == null ? t("editor.form.answerNumberMissing") : undefined}
          />
          <NumberField
            id="qf-deviation"
            label={t("editor.form.deviation")}
            value={q.answerDeviation}
            help={t("editor.form.deviationHelp")}
            onChange={(answerDeviation) => set({ answerDeviation })}
          />
        </div>
      )}
      {q.answerType === "point" &&
        (src ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-faint">{t("editor.form.pointHelp")}</span>
            <PointPicker
              src={src}
              target={q.answerPoint}
              radius={q.answerDeviation}
              onPick={(answerPoint) => set({ answerPoint })}
            />
            <NumberField
              id="qf-radius"
              label={t("editor.form.radius")}
              value={q.answerDeviation == null ? null : Math.round(q.answerDeviation * 100)}
              help={t("editor.form.radiusHelp")}
              onChange={(v) => set({ answerDeviation: v == null ? null : v / 100 })}
            />
          </div>
        ) : (
          <FieldError>{t("editor.form.pointNeedsImage")}</FieldError>
        ))}
    </div>
  );
}

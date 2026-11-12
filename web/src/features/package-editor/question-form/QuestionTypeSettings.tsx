import { answerFormat } from "@/game/answerFormat";
import { SecretRuleFields } from "./SecretRuleFields";
import { questionFormStyles } from "./questionFormStyles";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import type { QuestionFieldsProps } from "./questionUpdates";
import { draftPointImage, type DraftQuestion, type DraftMedia } from "../packageDraft";
import { FieldError, inputClass, Label } from "@/ui/Field";
import { PointPicker } from "@/features/game/play/PointPicker";
import { pointAnswerRadius } from "@/lib/pointGeometry";
import { mediaUrl } from "../packageMedia";
import { useMediaFile } from "../packageEditorStore";
import { QuestionCheckbox, NumberField, SecondsField } from "./QuestionFields";
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
      {!final && <QuestionScoringFields q={q} set={set} />}
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
          <SecretRuleFields q={q} set={set} />
        </>
      )}
      {answerFormat(q) === "select" && (
        <SecondsField
          id="qf-showdelay"
          label={t("editor.form.showDelay")}
          ms={q.showDelay}
          onChange={(showDelay) => set({ showDelay })}
        />
      )}
    </div>
  );
}

function QuestionScoringFields({ q, set }: QuestionFieldsProps) {
  const { t } = useTranslation();
  const { type } = q;
  return (
    <>
      {(type !== "secret" || (!q.secretRules && !q.allowedPrices.length)) && (
        <NumberField
          id="qf-real-price"
          integer
          label={t("editor.form.realPrice")}
          value={q.realPrice ?? null}
          help={t("editor.form.realPriceHelp")}
          onChange={(realPrice) => set({ realPrice })}
        />
      )}
      {(type === "simple" || type === "choice") && (
        <div className="flex flex-col gap-1.5">
          <QuestionCheckbox
            checked={q.forEveryone}
            onChange={(forEveryone) => set({ forEveryone })}
            label={t("editor.form.simpleEveryone")}
          />
          <span className="text-sm text-faint">{t("editor.form.simpleEveryoneHelp")}</span>
        </div>
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
    </>
  );
}

/** The mode and its explanation stay together beside the question. */
export function AnswerModeField({ q, set }: QuestionFieldsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor="qf-answer-type">{t("editor.form.answerType")}</Label>
      <select
        id="qf-answer-type"
        aria-describedby="qf-answer-type-help"
        value={q.answerType}
        onChange={(e) =>
          set({
            answerType: e.target.value as DraftQuestion["answerType"],
            answerDeviation: null,
            ...(e.target.value !== "select"
              ? {
                  compatibilityIssues: q.compatibilityIssues?.filter(
                    (issue) => issue.feature !== "select",
                  ),
                }
              : {}),
          })
        }
        className={inputClass}
      >
        {(["text", "number", "point", "select"] as const).map((v) => (
          <option key={v} value={v}>
            {t(`editor.form.answerTypes.${v}`)}
          </option>
        ))}
      </select>
      <span id="qf-answer-type-help" className="text-sm text-faint">
        {t(`editor.form.answerTypeHelp.${q.answerType}`)}
      </span>
    </div>
  );
}

/** Numeric and point settings need the full width below the mode. */
export function AnswerCheckFields({ q, set }: QuestionFieldsProps) {
  const { t } = useTranslation();
  const lastImage = q.questionFiles.filter((file) => file.type === "image").at(-1);
  const image = q.pointImageId !== undefined || q.answerPoint ? draftPointImage(q) : lastImage;
  const file = useMediaFile(image?.md5);
  const src = mediaUrl(file);
  if (q.answerType === "text") return null;
  return (
    <div className="flex min-w-0 flex-col gap-3">
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
      {q.answerType === "point" && (
        <>
          {src && image ? (
            <PointRadiusSettings
              key={`${src}:${image.occurrenceId}`}
              src={src}
              q={q}
              set={set}
              image={image}
            />
          ) : (
            <FieldError>{t("editor.form.pointNeedsImage")}</FieldError>
          )}
        </>
      )}
    </div>
  );
}

function PointRadiusSettings({
  src,
  q,
  set,
  image,
}: QuestionFieldsProps & { src: string; image: DraftMedia }) {
  const { t } = useTranslation();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const radius = pointAnswerRadius(q.answerPoint, q.answerDeviation);
  const max = size ? (0.6 * Math.max(size.width, size.height)) / size.width : 0;
  const source = q.answerPoint?.sourceGeometry;
  const horizontalRadius = radius / (source?.aspectRatio ?? 1);
  const percent = max ? (horizontalRadius / max) * 100 : 0;
  const pixels = size ? Math.round(horizontalRadius * size.width) : null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-faint">{t("editor.form.pointHelp")}</span>
      <PointPicker
        src={src}
        target={q.answerPoint}
        radius={q.answerDeviation}
        onImageLoad={(width, height) => setSize(width > 0 && height > 0 ? { width, height } : null)}
        onPick={(spot) =>
          set({
            pointImageId: image.occurrenceId,
            answerPoint: {
              x: Number(spot.x.toFixed(3)),
              y: Number(spot.y.toFixed(3)),
              ...(size ? { imageAspectRatio: size.width / size.height } : {}),
            },
          })
        }
      />
      {q.answerPoint?.sourceGeometry && (
        <span className="text-sm text-faint">{t("editor.form.pointSourceGeometry")}</span>
      )}
      <Label htmlFor="qf-radius">{t("editor.form.radius")}</Label>
      <input
        id="qf-radius"
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.min(100, Math.max(0, percent))}
        disabled={!size}
        onChange={(event) => {
          const point = q.answerPoint;
          set({
            answerDeviation: (Number(event.target.value) / 100) * max,
            ...(point
              ? {
                  answerPoint: {
                    x: point.x,
                    y: point.y,
                    ...(point.imageAspectRatio == null
                      ? {}
                      : { imageAspectRatio: point.imageAspectRatio }),
                  },
                }
              : {}),
          });
        }}
      />
      <span className="text-sm text-faint">
        {pixels == null
          ? t("editor.form.radiusLoading")
          : source && size
            ? t("editor.form.radiusSourceValue", {
                x: pixels,
                y: Math.round(radius * size.height),
              })
            : t("editor.form.radiusValue", { percent: Math.round(percent), pixels })}
      </span>
      {percent > 100 && (
        <span className="text-sm text-warning">{t("editor.form.radiusLegacy")}</span>
      )}
      {q.answerPoint && !q.answerPoint.imageAspectRatio && (
        <span className="text-sm text-faint">{t("editor.form.pointLegacy")}</span>
      )}
    </div>
  );
}

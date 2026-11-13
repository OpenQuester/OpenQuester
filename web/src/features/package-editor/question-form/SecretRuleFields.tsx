import { useTranslation } from "react-i18next";
import { Select, Label } from "@/ui/Field";
import type { SecretRules } from "@/game/secretRules";
import type { QuestionFieldsProps } from "./questionUpdates";
import { NumberField, PricesField } from "./QuestionFields";
import { questionFormStyles } from "./questionFormStyles";

const defaults: SecretRules = {
  outcome: "question",
  priceAnnouncement: "afterTransfer",
  priceChooser: "receiver",
  priceRule: null,
};

export function SecretRuleFields({ q, set }: QuestionFieldsProps) {
  const { t } = useTranslation();
  const rules = q.secretRules;
  const mode = rules ? (rules.priceRule?.kind ?? "fixed") : "legacy";
  const update = (patch: Partial<SecretRules>) =>
    set({ secretRules: { ...defaults, ...rules, ...patch }, allowedPrices: [] });
  return (
    <div className="flex flex-col gap-3">
      <div className={questionFormStyles.fieldPair}>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="qf-secret-kind">{t("editor.form.secretKind")}</Label>
          <Select
            id="qf-secret-kind"
            value={rules?.outcome ?? "question"}
            onChange={(event) => {
              const outcome = event.target.value as SecretRules["outcome"];
              update(
                outcome === "award"
                  ? { outcome, priceAnnouncement: "afterTransfer", priceChooser: "receiver" }
                  : { outcome },
              );
            }}
          >
            <option value="question">{t("editor.form.secretQuestion")}</option>
            <option value="award">{t("editor.form.secretAward")}</option>
          </Select>
          {rules?.outcome === "award" && (
            <p className="m-0 text-sm text-soft">{t("editor.form.secretAwardHelp")}</p>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="qf-secret-price-mode">{t("editor.form.secretPriceMode")}</Label>
          <Select
            id="qf-secret-price-mode"
            value={mode}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "legacy") set({ secretRules: null, realPrice: null });
              else
                set({
                  secretRules: {
                    ...defaults,
                    ...rules,
                    priceRule:
                      value === "fixed"
                        ? null
                        : value === "roundExtremes"
                          ? { kind: "roundExtremes" }
                          : { kind: "range", min: 0, max: 1000, step: 0 },
                  },
                  realPrice: value === "fixed" ? (q.realPrice ?? q.price ?? 0) : null,
                  allowedPrices: [],
                });
            }}
          >
            {(["legacy", "fixed", "roundExtremes", "range"] as const).map((value) => (
              <option key={value} value={value}>
                {t(`editor.form.secretPriceModes.${value}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className={questionFormStyles.fieldPair}>
        {mode === "legacy" ? (
          <PricesField
            value={q.allowedPrices}
            onChange={(allowedPrices) =>
              set({ allowedPrices, realPrice: allowedPrices.length ? null : q.realPrice })
            }
          />
        ) : mode === "fixed" ? (
          <NumberField
            id="qf-real-price"
            integer
            label={t("editor.form.realPrice")}
            value={q.realPrice ?? q.price}
            onChange={(realPrice) => set({ realPrice })}
          />
        ) : (
          mode === "range" &&
          rules?.priceRule?.kind === "range" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(["min", "max", "step"] as const).map((key) => (
                <NumberField
                  key={key}
                  id={`qf-secret-${key}`}
                  integer
                  label={t(`editor.form.secretRange.${key}`)}
                  value={rules.priceRule?.kind === "range" ? rules.priceRule[key] : null}
                  onChange={(value) =>
                    update({
                      priceRule: {
                        ...(rules.priceRule as Extract<
                          NonNullable<SecretRules["priceRule"]>,
                          { kind: "range" }
                        >),
                        [key]: value ?? -1,
                      },
                    })
                  }
                />
              ))}
            </div>
          )
        )}
        {rules && rules.outcome !== "award" && (
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="qf-secret-order">{t("editor.form.secretOrder")}</Label>
            <Select
              id="qf-secret-order"
              value={rules.priceChooser === "opener" ? "opener" : rules.priceAnnouncement}
              onChange={(event) =>
                update({
                  priceChooser: event.target.value === "opener" ? "opener" : "receiver",
                  priceAnnouncement:
                    event.target.value === "afterTransfer" ? "afterTransfer" : "beforeTransfer",
                })
              }
            >
              {(["afterTransfer", "beforeTransfer", "opener"] as const).map((value) => (
                <option key={value} value={value}>
                  {t(`editor.form.secretOrders.${value}`)}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}

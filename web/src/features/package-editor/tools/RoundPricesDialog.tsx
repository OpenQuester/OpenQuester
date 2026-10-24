import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { formatScore } from "@/lib/format";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { FieldGroup, TextInput } from "@/ui/Field";
import { useRoundPrices } from "./useRoundTools";

/** Every question of a round gets a price: the first `base`, then + `step`. */
export function RoundPricesDialog({
  roundId,
  onClose,
}: {
  roundId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { base, setBase, step, setStep, firstPrice, priceStep, valid, save } = useRoundPrices(
    roundId,
    onClose,
  );
  return (
    <Dialog
      open={roundId != null}
      onOpenChange={(o) => !o && onClose()}
      title={t("editor.tools.pricesTitle")}
      description={t("editor.tools.pricesHelp")}
      closeLabel={t("common.close")}
    >
      <form
        className={layoutStyles.cardBody}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup htmlFor="rp-base" label={t("editor.tools.firstPrice")}>
            <TextInput
              id="rp-base"
              inputMode="numeric"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            />
          </FieldGroup>
          <FieldGroup htmlFor="rp-step" label={t("editor.tools.step")}>
            <TextInput
              id="rp-step"
              inputMode="numeric"
              value={step}
              onChange={(e) => setStep(e.target.value)}
            />
          </FieldGroup>
        </div>
        {valid && (
          <p className="m-0 text-sm text-muted">
            {t("editor.tools.pricesPreview", {
              prices: [0, 1, 2, 3, 4]
                .map((i) => formatScore(firstPrice + i * priceStep))
                .join(", "),
            })}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" variant="accent" size="lg" disabled={!valid}>
            {t("editor.tools.applyPrices")}
          </Button>
          <Button size="lg" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

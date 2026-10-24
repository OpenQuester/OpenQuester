import { actionDockStyles, actionStack } from "./actionDockStyles";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/Field";

export function BidControls({
  min,
  max,
  allIn,
  onBid,
  onAllIn,
  onPass,
  cta,
}: {
  min: number;
  max: number;
  allIn: number | null;
  onBid: (amount: number) => void;
  onAllIn?: () => void;
  onPass?: () => void;
  cta?: string;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(String(min));
  const amount = Number(value);
  const valid = Number.isInteger(amount) && amount >= min && amount <= max;
  const quick = [...new Set([min, Math.round((min + max) / 2 / 100) * 100, max])].filter(
    (v) => v >= min && v <= max && v > 0,
  );
  return (
    <form
      className={actionStack}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onBid(amount);
      }}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("bid.quick")}>
        {quick.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setValue(String(q))}
            className={cn(
              actionDockStyles.bid,
              Number(value) === q
                ? "border-accent bg-accent-surface text-accent-strong"
                : "border-line-strong text-text",
            )}
          >
            {formatScore(q)}
          </button>
        ))}
        {allIn != null && onAllIn && (
          <button type="button" onClick={onAllIn} className={actionDockStyles.allInBid}>
            {t("bid.allIn", { amount: formatScore(allIn) })}
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <label htmlFor="bid-amount" className="sr-only">
          {t("bid.amount")}
        </label>
        <TextInput
          id="bid-amount"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
          className="w-28 flex-none font-mono"
          aria-invalid={!valid || undefined}
          data-no-shortcuts
        />
        <Button
          type="submit"
          variant="accent"
          className="flex-1"
          inactive={!valid}
          data-testid="bid-submit"
        >
          {valid
            ? (cta ?? t("bid.bid", { amount: formatScore(amount) }))
            : t("bid.range", { min: formatScore(min), max: formatScore(max) })}
        </Button>
        {onPass && (
          <Button variant="ghost" onClick={onPass} data-testid="bid-pass">
            {t("bid.pass")}
          </Button>
        )}
      </div>
    </form>
  );
}

import { actionDockStyles, actionStack } from "./actionDockStyles";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { Button } from "@/ui/Button";
import { TextInput } from "@/ui/Field";

type BidRange = { min: number; max: number };

function validBid(range: BidRange | null, value: string, amount: number): boolean {
  return (
    !!range &&
    value !== "" &&
    Number.isInteger(amount) &&
    amount >= range.min &&
    amount <= range.max
  );
}

export function BidControls({
  range,
  allIn,
  pending,
  unavailable,
  onBid,
  onAllIn,
  onPass,
  cta,
}: {
  range: BidRange | null;
  allIn: number | null;
  pending: boolean;
  unavailable?: string;
  onBid: (amount: number) => void;
  onAllIn?: () => void;
  onPass?: () => void;
  cta?: string;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(range ? String(range.min) : "");
  const amount = Number(value);
  const valid = validBid(range, value, amount);
  const quick = range
    ? [
        ...new Set([range.min, Math.round((range.min + range.max) / 2 / 100) * 100, range.max]),
      ].filter((v) => v >= range.min && v <= range.max && v > 0)
    : [];
  return (
    <form
      className={actionStack}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !pending) onBid(amount);
      }}
    >
      {pending && (
        <p className="m-0 text-sm text-soft" role="status">
          {t("dock.sending")}
        </p>
      )}
      {unavailable && <p className="m-0 text-sm text-soft">{unavailable}</p>}
      <fieldset disabled={pending} className="m-0 flex min-w-0 w-full flex-col gap-2 border-0 p-0">
        {(quick.length > 0 || (allIn != null && onAllIn)) && (
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
        )}
        {range && (
          <BidAmountFields
            range={range}
            value={value}
            amount={amount}
            valid={valid}
            setValue={setValue}
            cta={cta}
          />
        )}
        {onPass && (
          <Button variant="ghost" onClick={onPass} data-testid="bid-pass">
            {t("bid.pass")}
          </Button>
        )}
      </fieldset>
    </form>
  );
}

function BidAmountFields({
  range,
  value,
  amount,
  valid,
  setValue,
  cta,
}: {
  range: BidRange;
  value: string;
  amount: number;
  valid: boolean;
  setValue: (value: string) => void;
  cta?: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,3fr)] items-center gap-2">
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={1}
          value={Math.min(
            range.max,
            Math.max(range.min, Number.isFinite(amount) && value !== "" ? amount : range.min),
          )}
          onChange={(event) => setValue(event.target.value)}
          disabled={range.min === range.max}
          aria-label={t("bid.slider")}
          className="min-h-11 min-w-0 w-full accent-[var(--oq-accent)]"
          data-no-shortcuts
        />
        <label htmlFor="bid-amount" className="sr-only">
          {t("bid.amount")}
        </label>
        <TextInput
          id="bid-amount"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 w-full font-mono"
          aria-invalid={!valid || undefined}
          data-no-shortcuts
        />
      </div>
      <Button
        type="submit"
        variant="accent"
        className="flex-1"
        inactive={!valid}
        data-testid="bid-submit"
      >
        {valid
          ? (cta ?? t("bid.bid", { amount: formatScore(amount) }))
          : t("bid.range", { min: formatScore(range.min), max: formatScore(range.max) })}
      </Button>
    </>
  );
}

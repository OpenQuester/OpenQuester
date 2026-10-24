import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FieldError, Label, TextInput } from "@/ui/Field";
export function NumberField({
  id,
  label,
  value,
  onChange,
  help,
  error,
  integer,
}: {
  id: string;
  label: ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  help?: string;
  error?: string;
  /** Whole numbers only (prices, bids); other fields keep decimals like 3.14 */
  integer?: boolean;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    // Keep what's typed ("1." while typing 1.5) when it already means this value.
    if (!(text !== "" && Number(text) === value)) setText(value == null ? "" : String(value));
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <TextInput
        id={id}
        inputMode="decimal"
        value={text}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.-]/g, "");
          setText(v);
          if (v === "") onChange(null);
          else if (!Number.isNaN(Number(v))) onChange(integer ? Math.round(Number(v)) : Number(v));
        }}
      />
      {help && <span className="text-sm text-faint">{help}</span>}
      <FieldError>{error}</FieldError>
    </div>
  );
}
export function SecondsField({
  id,
  label,
  ms,
  onChange,
}: {
  id: string;
  label: string;
  ms: number;
  onChange: (ms: number) => void;
}) {
  return (
    <NumberField
      id={id}
      label={label}
      value={Math.round(ms / 100) / 10}
      onChange={(s) => onChange(Math.max(0, Math.round((s ?? 0) * 1000)))}
    />
  );
}
export function QuestionCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
export function PricesField({
  value,
  onChange,
}: {
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(value.join(", "));
  const bad = value.length > 0 && (value.length < 2 || value.length > 5);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="qf-prices">{t("editor.form.allowedPrices")}</Label>
      <TextInput
        id="qf-prices"
        value={text}
        placeholder="100, 300, 500"
        onChange={(e) => {
          setText(e.target.value);
          onChange(
            e.target.value
              .split(/[,\s]+/)
              .filter(Boolean)
              .map(Number)
              .filter((n) => Number.isFinite(n)),
          );
        }}
      />
      <span className="text-sm text-faint">{t("editor.form.allowedPricesHelp")}</span>
      <FieldError>
        {bad ? t("editor.issues.secretPrices", { count: value.length }) : undefined}
      </FieldError>
    </div>
  );
}

export function OptionalTextField({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label} <span className="font-normal text-faint">{t("editor.optional")}</span>
      </Label>
      <TextInput id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="text-sm text-faint">{help}</span>
    </div>
  );
}

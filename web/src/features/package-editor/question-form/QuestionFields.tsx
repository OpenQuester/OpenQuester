import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FieldError, Label, TextInput } from "@/ui/Field";
import { ChoiceInput } from "@/ui/ChoiceInput";
export function NumberField({
  id,
  label,
  value,
  onChange,
  help,
  error,
  integer,
  unit,
  required,
}: {
  id: string;
  label: ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  help?: string;
  error?: string;
  /** Whole numbers only (prices, bids); other fields keep decimals like 3.14 */
  integer?: boolean;
  unit?: string;
  required?: boolean;
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
      <Label htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </Label>
      <div className="flex items-center gap-2">
        <TextInput
          id={id}
          inputMode="decimal"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-required={required}
          aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
          onChange={(e) => {
            const v = e.target.value.replace(",", ".").replace(/[^\d.-]/g, "");
            setText(v);
            if (v === "") onChange(null);
            else if (!Number.isNaN(Number(v)))
              onChange(integer ? Math.round(Number(v)) : Number(v));
          }}
        />
        {unit && <span className="shrink-0 text-sm text-muted">{unit}</span>}
      </div>
      {help && (
        <span id={`${id}-help`} className="text-sm text-faint">
          {help}
        </span>
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
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
  const { t } = useTranslation();
  return (
    <NumberField
      id={id}
      label={label}
      unit={t("editor.form.secondsUnit")}
      value={Math.round(ms / 100) / 10}
      onChange={(s) => onChange(Math.max(0, Math.round((s ?? 0) * 1000)))}
    />
  );
}
export function QuestionCheckbox({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  help?: string;
}) {
  const helpId = useId();
  return (
    <div className="group relative w-fit">
      <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-sm px-2 text-text transition-colors hover:bg-surface-3 focus-within:bg-surface-3">
        <ChoiceInput
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={help ? helpId : undefined}
        />
        {label}
      </label>
      {help && (
        <span
          id={helpId}
          role="tooltip"
          className="pointer-events-none invisible absolute top-full left-0 z-20 w-max max-w-[min(20rem,calc(100vw-4rem))] rounded-sm border border-line bg-surface-3 p-2 text-sm font-normal text-text opacity-0 shadow-lg transition-[visibility,opacity] duration-150 group-hover:visible group-hover:opacity-100 group-hover:delay-300 group-focus-within:visible group-focus-within:opacity-100 group-focus-within:delay-300"
        >
          {help}
        </span>
      )}
    </div>
  );
}

export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-1 text-danger">
      *
    </span>
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

export function QuestionTextField({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <TextInput
        id={id}
        value={value}
        aria-describedby={help ? `${id}-help` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {help && (
        <span id={`${id}-help`} className="text-sm text-faint">
          {help}
        </span>
      )}
    </div>
  );
}

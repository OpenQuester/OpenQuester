import { mediaControlStyles } from "../MediaControls";
import { useState } from "react";
import { inputClass } from "@/ui/Field";
import { formatTime, parseTime } from "../mediaEdits";

export function TimeInput({
  label,
  value,
  disabled,
  onChange,
  onFinish,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onFinish: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className={mediaControlStyles.label}>
      {label}
      <input
        className={inputClass + " tabular-nums"}
        type="text"
        placeholder="00:00.00"
        disabled={disabled}
        value={draft ?? formatTime(value)}
        aria-invalid={!Number.isFinite(value) || undefined}
        onFocus={() => setDraft(formatTime(value))}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(parseTime(e.target.value));
        }}
        onBlur={() => {
          setDraft(null);
          onFinish();
        }}
      />
    </label>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { inputClass, Label } from "@/ui/Field";

/** A list of short texts typed one per line (answers, authors, sources). */
export function LinesField({
  id,
  label,
  help,
  value,
  onChange,
  optional = true,
}: {
  id: string;
  label: string;
  help?: string;
  value: string[];
  onChange: (next: string[]) => void;
  optional?: boolean;
}) {
  const { t } = useTranslation();
  // Keep the raw text while typing so empty lines and spaces don't jump.
  const [text, setText] = useState(value.join("\n"));
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label} {optional && <span className="font-normal text-faint">{t("editor.optional")}</span>}
      </Label>
      <textarea
        id={id}
        rows={2}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(
            e.target.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          );
        }}
        className={cn(inputClass, "resize-y py-3")}
      />
      {help && <span className="text-sm text-faint">{help}</span>}
    </div>
  );
}

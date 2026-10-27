import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { FieldGroup, inputClass } from "@/ui/Field";

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
  help?: ReactNode;
  value: string[];
  onChange: (next: string[]) => void;
  optional?: boolean;
}) {
  const { t } = useTranslation();
  // Keep the raw text while typing so empty lines and spaces don't jump.
  const [text, setText] = useState(value.join("\n"));
  return (
    <FieldGroup
      htmlFor={id}
      label={
        <>
          {label}{" "}
          {optional && <span className="font-normal text-faint">{t("editor.optional")}</span>}
        </>
      }
      help={help}
    >
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
    </FieldGroup>
  );
}

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import type { FileRef, MediaFile } from "@/features/upload/types";
import { mediaTypeOf } from "../packageMedia";
import { useMediaFile } from "../packageEditorStore";
import { AttachmentPreview } from "../AttachmentPreview";
import { useOpenMedia } from "./useStagedMedia";
export function SingleMediaField({
  value,
  onChange,
  label,
}: {
  value: FileRef | null;
  onChange: (file: FileRef | null) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const file = useMediaFile(value?.md5);
  const open = useOpenMedia();
  const input = useRef<HTMLInputElement>(null);
  const [undo, setUndo] = useState<{ value: FileRef | null } | null>(null);
  const [error, setError] = useState(false);
  const edit = (sources: (File | MediaFile)[]) =>
    open(sources, label, ({ file: result }) => {
      if (result.type !== "image") {
        setError(true);
        return;
      }
      setUndo({ value });
      onChange({ md5: result.md5, type: result.type });
    });
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {value && (
        <div className="w-28">
          <AttachmentPreview media={value} className="h-20 w-full" />
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked) {
            if (mediaTypeOf(picked) === "image") {
              setError(false);
              edit([picked]);
            } else setError(true);
          }
        }}
      />
      <Button onClick={() => input.current?.click()}>{label}</Button>
      {file && <Button onClick={() => edit([file])}>{t("mediaEditor.edit")}</Button>}
      {value && (
        <Button
          onClick={() => {
            setUndo({ value });
            onChange(null);
          }}
        >
          {t("editor.media.remove")}
        </Button>
      )}
      {undo && (
        <Button
          onClick={() => {
            onChange(undo.value);
            setUndo(null);
          }}
        >
          {t("mediaEditor.undo")}
        </Button>
      )}
      {error && (
        <span role="alert" className="text-danger">
          {t("mediaEditor.errors.mediaType")}
        </span>
      )}
    </div>
  );
}

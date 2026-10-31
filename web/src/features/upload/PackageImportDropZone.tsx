import { uploadStyles } from "./uploadStyles";
import { useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { UploadIcon } from "@/ui/icons";
import { ACCEPT } from "./upload";

export function PackageImportDropZone({
  onFile,
  error,
}: {
  onFile: (f: File) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };
  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          uploadStyles.dropZone,
          over ? "border-accent bg-accent-surface" : "border-line-strong bg-surface",
        )}
      >
        <span className={uploadStyles.dropIcon}>
          <UploadIcon size={30} />
        </span>
        <p className="m-0 text-lg font-semibold">{t("upload.drop")}</p>
        <p className={uploadStyles.importHelp}>{t("upload.formats")}</p>
        <input
          ref={input}
          id="package-file"
          type="file"
          accept={ACCEPT}
          className="sr-only"
          // The visible button opens it; one control for assistive tech.
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
        <Button
          data-import-picker
          variant="accent"
          size="lg"
          onClick={() => input.current?.click()}
        >
          {t("upload.choose")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="m-0 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

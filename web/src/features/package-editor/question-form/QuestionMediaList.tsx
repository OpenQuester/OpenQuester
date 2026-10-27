import { questionFormStyles } from "./questionFormStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useQuestionMedia, type QuestionMediaListProps } from "./useQuestionMedia";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { TrashIcon, UploadIcon } from "@/ui/icons";
import { AttachmentPreview, MediaIcon } from "../AttachmentPreview";
import { useState } from "react";
export function QuestionMediaList({
  label,
  help,
  files,
  onChange,
  onGeometryChange,
}: QuestionMediaListProps) {
  const { t } = useTranslation();
  const {
    inputRef,
    over,
    setOver,
    hasUndo,
    undoChange,
    add,
    onDrop,
    edit,
    canEdit,
    setDisplayTime,
  } = useQuestionMedia({ label, help, files, onChange, onGeometryChange });
  return (
    <div className="flex flex-col gap-2">
      <div className={layoutStyles.spacedActions}>
        <span className="flex-1 text-[15px] font-semibold">{label}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,audio/*,video/*"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) void add([...e.target.files]);
            e.target.value = "";
          }}
        />
        <Button size="sm" icon={<UploadIcon size={16} />} onClick={() => inputRef.current?.click()}>
          {t("editor.media.add")}
        </Button>
      </div>
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          questionFormStyles.attachmentDropZone,
          over ? "border-accent bg-accent-surface" : "border-line",
        )}
      >
        {files.map((m, i) => (
          <div key={i} className={questionFormStyles.attachment} data-testid="attachment-card">
            <AttachmentPreview
              media={m}
              className={m.type === "image" ? "h-28 w-full" : "w-full"}
            />
            <Button onClick={() => edit(m, i)} disabled={!canEdit(m)}>
              {t("mediaEditor.edit")}
            </Button>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span
                className="flex min-w-0 flex-1 items-center gap-2 text-soft"
                role="img"
                aria-label={t(`editor.media.${m.type}`)}
              >
                <MediaIcon type={m.type} />
              </span>
              <button
                type="button"
                aria-label={t("editor.media.remove")}
                onClick={() => {
                  onGeometryChange?.(i);
                  onChange((current) => current.filter((_, j) => j !== i));
                }}
                className={cn(questionFormStyles.attachmentRemove, "shrink-0")}
              >
                <TrashIcon size={16} />
              </button>
            </div>
            {m.type === "image" && (
              <DurationInput
                key={m.md5}
                value={m.displayTime}
                onChange={(value) => setDisplayTime(i, value)}
              />
            )}
          </div>
        ))}
        <span className={questionFormStyles.attachmentHint}>
          {files.length ? t("editor.media.dropMore") : help}
        </span>
      </div>
      {hasUndo && (
        <Button className="self-start" onClick={undoChange}>
          {t("mediaEditor.undo")}
        </Button>
      )}
    </div>
  );
}

function DurationInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => (value == null ? "" : String(value / 1000)));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    if (text === "" || Math.round(Number(text.replace(",", ".")) * 1000) !== value)
      setText(value == null ? "" : String(value / 1000));
  }
  return (
    <label className="flex items-center gap-1.5 text-faint">
      {t("editor.media.show")}
      <input
        inputMode="decimal"
        value={text}
        className={questionFormStyles.attachmentTime}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value);
        }}
      />
      {t("editor.secondsShort")}
    </label>
  );
}

import { questionFormStyles } from "./questionFormStyles";
import { packageBoardStyles } from "../board/packageBoardStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useQuestionMedia, type QuestionMediaListProps } from "./useQuestionMedia";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { GripIcon, TrashIcon, UploadIcon } from "@/ui/icons";
import { AttachmentPreview } from "../AttachmentPreview";
import { newId, type DraftQuestion } from "../packageDraft";
import { questionSteps, withQuestionSteps, type QuestionStep } from "./questionTimeline";
import { moveTimeline, stepId } from "./timelineMove";
import type { ApplyMediaChange } from "./questionMediaHistory";
import { useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useAttachmentReorder } from "./useAttachmentReorder";

type Timeline = {
  q: DraftQuestion;
  setQ: Dispatch<SetStateAction<DraftQuestion>>;
  applyTimeline: ApplyMediaChange;
};

export function QuestionMediaList({
  label,
  help,
  files,
  onChange,
  slot,
  applyMedia,
  point,
  pointImageId,
  children,
  timeline,
}: QuestionMediaListProps & { children?: ReactNode; timeline?: Timeline }) {
  const { t } = useTranslation();
  const { inputRef, over, setOver, remove, add, onDrop, edit, canEdit, setDisplayTime, move } =
    useQuestionMedia({ label, help, files, onChange, slot, applyMedia, point, pointImageId });
  const addButton = useRef<HTMLButtonElement>(null);
  const steps: Exclude<QuestionStep, { kind: "main" }>[] = timeline
    ? questionSteps(timeline.q).filter(
        (step): step is Exclude<QuestionStep, { kind: "main" }> => step.kind !== "main",
      )
    : files.map((file) => ({ kind: "media", file }));
  const moveStep = (id: string, destination: number) => {
    if (timeline) {
      const offset = timeline.q.mainTextFirst ? 1 : 0;
      timeline.applyTimeline(moveTimeline(id, destination + offset));
    } else {
      const file = steps.find((step) => stepId(step) === id);
      if (file?.kind === "media" && file.file.occurrenceId)
        move(file.file.occurrenceId, destination);
    }
  };
  const reorder = useAttachmentReorder(steps, moveStep, timeline ? 2 : 1);
  return (
    <div className="flex flex-col gap-2">
      <div className={layoutStyles.spacedActions}>
        <span className="flex-1 text-[15px] font-semibold">{label}</span>
        {timeline && (
          <Button
            size="sm"
            onClick={() =>
              timeline.setQ((current) =>
                withQuestionSteps(current, [
                  ...questionSteps(current),
                  { kind: "text", item: { id: newId(), text: "", order: 0 } },
                ]),
              )
            }
          >
            {t("editor.timeline.add")}
          </Button>
        )}
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
        <Button
          ref={addButton}
          size="sm"
          icon={<UploadIcon size={16} />}
          onClick={() => inputRef.current?.click()}
        >
          {t("editor.media.add")}
        </Button>
      </div>
      <span id={reorder.helpId} className="sr-only">
        {t("editor.timeline.moveHandle")}
      </span>
      <span className="sr-only" aria-live="polite">
        {reorder.announcement}
      </span>
      <div
        data-testid="attachment-drop-zone"
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
        {steps.map((step, index) => {
          const id = stepId(step);
          const mediaIndex =
            step.kind === "media"
              ? files.findIndex((file) => file.occurrenceId === step.file.occurrenceId)
              : -1;
          const number = timeline ? index + 2 : index + 1;
          const label =
            step.kind === "media"
              ? t("editor.media.dragFile", { number: mediaIndex + 1 })
              : t("editor.timeline.text", { number });
          const grip = (
            <button
              type="button"
              aria-label={label}
              aria-describedby={reorder.helpId}
              title={t("editor.timeline.moveHandle")}
              draggable
              className="inline-flex size-11 shrink-0 touch-none cursor-grab items-center justify-center rounded-sm text-muted hover:bg-surface-3 hover:text-text active:cursor-grabbing"
              {...reorder.grip(id, index)}
            >
              <GripIcon size={16} />
            </button>
          );
          return (
            <div
              key={id}
              data-timeline-card
              data-timeline-id={id}
              data-testid={step.kind === "media" ? "attachment-card" : "text-step-card"}
              className={cn(
                questionFormStyles.attachment,
                "relative",
                reorder.dragging === id && "opacity-40",
              )}
              {...reorder.card(id)}
            >
              {reorder.insertion?.id === id && (
                <span
                  aria-hidden
                  className={cn(
                    reorder.insertion.vertical
                      ? "absolute z-10 inset-x-1 h-1 rounded-full bg-accent"
                      : packageBoardStyles.questionInsertion,
                    reorder.insertion.vertical
                      ? reorder.insertion.edge === "before"
                        ? "-top-1.5"
                        : "-bottom-1.5"
                      : reorder.insertion.edge === "before"
                        ? "-left-1.5"
                        : "-right-1.5",
                  )}
                />
              )}
              {step.kind === "media" ? (
                <>
                  <AttachmentPreview
                    disableImageDrag
                    media={step.file}
                    className={step.file.type === "image" ? "h-28 w-full" : "w-full"}
                  />
                  <div className="flex min-w-0 items-center gap-2">
                    <Button
                      className="min-w-0 flex-1 [overflow-wrap:anywhere]"
                      onClick={() => edit(step.file, mediaIndex)}
                      disabled={!canEdit(step.file)}
                    >
                      {t("mediaEditor.edit")}
                    </Button>
                    {grip}
                    <button
                      type="button"
                      aria-label={t("editor.media.remove")}
                      onClick={() => {
                        remove(mediaIndex);
                        addButton.current?.focus();
                      }}
                      className={questionFormStyles.attachmentRemove}
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                  {step.file.type === "image" && (
                    <DurationInput
                      key={step.file.md5}
                      value={step.file.displayTime}
                      onChange={(value) => setDisplayTime(mediaIndex, value)}
                    />
                  )}
                </>
              ) : step.kind === "text" && timeline ? (
                <>
                  <textarea
                    aria-label={label}
                    placeholder={label}
                    className="min-h-28 max-h-60 w-full resize-y rounded-sm border border-line bg-bg p-2 text-text"
                    value={step.item.text}
                    onChange={(event) => {
                      const text = event.target.value;
                      timeline.setQ((current) => ({
                        ...current,
                        textItems: current.textItems?.map((item) =>
                          item.id === step.item.id ? { ...item, text } : item,
                        ),
                      }));
                    }}
                  />
                  <div className="flex items-center justify-end gap-2">
                    {grip}
                    <button
                      type="button"
                      aria-label={t("editor.timeline.remove", { number })}
                      className={questionFormStyles.attachmentRemove}
                      onClick={() => {
                        timeline.setQ((current) =>
                          withQuestionSteps(
                            current,
                            questionSteps(current).filter(
                              (item) => item.kind !== "text" || item.item.id !== step.item.id,
                            ),
                          ),
                        );
                        addButton.current?.focus();
                      }}
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
        <span className={questionFormStyles.attachmentHint}>
          {steps.length ? t("editor.media.dropMore") : help}
        </span>
      </div>
      {children}
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

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
import { useId, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

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
  const helpId = useId();
  const dragged = useRef<string | null>(null);
  const dragCard = useRef<HTMLElement | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [insertion, setInsertion] = useState<{
    id: string;
    edge: "before" | "after";
    vertical: boolean;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
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
  const clearDrag = () => {
    const card = dragCard.current;
    dragCard.current = null;
    window.setTimeout(() => {
      if (dragCard.current !== card) card?.removeAttribute("data-timeline-dragging");
    }, 0);
    dragged.current = null;
    setDragging(null);
    setInsertion(null);
  };
  const edgeAt = (card: HTMLElement, x: number, y: number) => {
    const rect = card.getBoundingClientRect();
    const parent = card.parentElement?.getBoundingClientRect();
    const vertical = !!parent && rect.width > parent.width * 0.8;
    return {
      vertical,
      edge: (vertical ? y < rect.top + rect.height / 2 : x < rect.left + rect.width / 2)
        ? ("before" as const)
        : ("after" as const),
    };
  };
  const touchTarget = (handle: HTMLElement, x: number, y: number) => {
    const card = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-timeline-card]");
    return card && handle.closest('[data-testid="attachment-drop-zone"]')?.contains(card)
      ? card
      : null;
  };
  const dropAt = (source: string, target: string, edge: "before" | "after") => {
    const from = steps.findIndex((item) => stepId(item) === source);
    const index = steps.findIndex((item) => stepId(item) === target);
    if (from < 0 || index < 0) return;
    const at = index + (edge === "after" ? 1 : 0);
    moveStep(source, at - (from < at ? 1 : 0));
  };
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
      <span id={helpId} className="sr-only">
        {t("editor.timeline.moveHandle")}
      </span>
      <span className="sr-only" aria-live="polite">
        {announcement}
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
              aria-describedby={helpId}
              title={t("editor.timeline.moveHandle")}
              draggable
              className="inline-flex size-11 shrink-0 touch-none cursor-grab items-center justify-center rounded-sm text-muted hover:bg-surface-3 hover:text-text active:cursor-grabbing"
              onKeyDown={(event) => {
                if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                const offset =
                  event.key === "ArrowLeft" || event.key === "ArrowUp"
                    ? -1
                    : event.key === "ArrowRight" || event.key === "ArrowDown"
                      ? 1
                      : 0;
                if (!offset) return;
                event.preventDefault();
                event.stopPropagation();
                const destination = index + offset;
                if (destination < 0 || destination >= steps.length) return;
                moveStep(id, destination);
                setAnnouncement(
                  t("editor.timeline.moveStatus", {
                    number: timeline ? destination + 2 : destination + 1,
                  }),
                );
              }}
              onPointerDown={(event) => {
                if (event.pointerType !== "touch") return;
                event.currentTarget.setPointerCapture(event.pointerId);
                dragged.current = id;
                dragCard.current = event.currentTarget.closest<HTMLElement>("[data-timeline-card]");
                dragCard.current?.setAttribute("data-timeline-dragging", "true");
                setDragging(id);
              }}
              onPointerMove={(event) => {
                if (event.pointerType !== "touch" || dragged.current !== id) return;
                const card = touchTarget(event.currentTarget, event.clientX, event.clientY);
                const target = card?.dataset.timelineId;
                if (!card || !target) {
                  setInsertion(null);
                  return;
                }
                setInsertion({ id: target, ...edgeAt(card, event.clientX, event.clientY) });
              }}
              onPointerUp={(event) => {
                if (event.pointerType !== "touch" || dragged.current !== id) return;
                const card = touchTarget(event.currentTarget, event.clientX, event.clientY);
                if (card?.dataset.timelineId)
                  dropAt(
                    id,
                    card.dataset.timelineId,
                    edgeAt(card, event.clientX, event.clientY).edge,
                  );
                clearDrag();
              }}
              onPointerCancel={(event) => {
                if (event.pointerType === "touch") clearDrag();
              }}
              onDragStart={(event) => {
                dragged.current = id;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", id);
                const card = event.currentTarget.closest<HTMLElement>("[data-timeline-card]");
                dragCard.current = card;
                card?.setAttribute("data-timeline-dragging", "true");
                if (card) event.dataTransfer.setDragImage(card, 20, 20);
                event.stopPropagation();
                window.setTimeout(() => {
                  if (dragged.current === id) setDragging(id);
                }, 0);
              }}
              onDragEnd={clearDrag}
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
                dragging === id && "opacity-40",
              )}
              onDragOver={(event) => {
                if (!dragged.current) return;
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = "move";
                const { edge, vertical } = edgeAt(
                  event.currentTarget,
                  event.clientX,
                  event.clientY,
                );
                setInsertion((prev) =>
                  prev?.id === id && prev.edge === edge && prev.vertical === vertical
                    ? prev
                    : { id, edge, vertical },
                );
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                  setInsertion(null);
              }}
              onDrop={(event) => {
                const source = dragged.current;
                if (!source) return;
                event.preventDefault();
                event.stopPropagation();
                dropAt(source, id, edgeAt(event.currentTarget, event.clientX, event.clientY).edge);
                clearDrag();
              }}
            >
              {insertion?.id === id && (
                <span
                  aria-hidden
                  className={cn(
                    insertion.vertical
                      ? "absolute z-10 inset-x-1 h-1 rounded-full bg-accent"
                      : packageBoardStyles.questionInsertion,
                    insertion.vertical
                      ? insertion.edge === "before"
                        ? "-top-1.5"
                        : "-bottom-1.5"
                      : insertion.edge === "before"
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

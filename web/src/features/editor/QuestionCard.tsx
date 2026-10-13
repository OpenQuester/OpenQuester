import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { CopyIcon, EditIcon, MoveIcon, TrashIcon } from "@/ui/icons";
import { Menu } from "@/ui/Menu";

import { dragSource, useDragging, useDropTarget, type Edge } from "./dnd";
import type { EditorQuestion } from "./model";
import { MediaIcon, MediaView, QuestionPreview } from "./QuestionPreview";
import { useEditor } from "./store";
import type { Severity } from "./validate";

export interface CardActions {
  open: (id: string) => void;
  edit: (id: string) => void;
  move: (id: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  dropQuestion: (questionId: string, beforeIndex: number) => void;
}

export function QuestionCard({
  question: q,
  index,
  final,
  issue,
  actions,
}: {
  question: EditorQuestion;
  index: number;
  final: boolean;
  issue?: Severity;
  actions: CardActions;
}) {
  const { t } = useTranslation();
  const density = useEditor((s) => s.density);
  const selected = useEditor((s) => s.selectedId === q.id);
  const drag = useDragging();
  const isDragged = drag?.kind === "question" && drag.id === q.id;
  const drop = useDropTarget({
    accepts: (d) => d.kind === "question" && d.id !== q.id,
    axis: "x",
    onDrop: (d, edge: Edge) => actions.dropQuestion(d.id, edge === "before" ? index : index + 1),
  });
  const cards = density === "cards";
  const type = final ? "simple" : q.type;
  const image = q.questionFiles.find((m) => m.type === "image");
  const mediaTypes = [...new Set([...q.questionFiles, ...q.answerFiles].map((m) => m.type))];
  const label = [
    final ? "" : String(q.price ?? ""),
    type !== "simple" ? t(`questionTypes.${type}`) : "",
    q.text,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <button
      type="button"
      data-testid="question-card"
      aria-label={label || t("editor.board.emptyQuestion")}
      aria-pressed={selected}
      onClick={() => actions.open(q.id)}
      onDoubleClick={() => actions.edit(q.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey || e.altKey)) actions.edit(q.id);
      }}
      className={cn(
        "flex h-full w-full flex-col items-stretch gap-1.5 rounded-md border-2 p-2.5 text-left text-text",
        selected
          ? "border-accent bg-accent-surface"
          : issue === "critical"
            ? "border-danger-strong/70 bg-danger-surface"
            : "border-line bg-surface-2 hover:border-line-strong",
        cards ? "min-h-[150px]" : "min-h-[84px]",
      )}
    >
      <span className="flex items-center gap-2 pr-7">
        {!final && (
          <span
            className={cn(
              "font-display text-[22px] leading-none font-extrabold",
              issue === "critical"
                ? "text-danger"
                : selected
                  ? "text-accent-strong"
                  : "text-accent",
            )}
          >
            {q.price ?? "—"}
          </span>
        )}
        <span className="flex items-center gap-1 text-info-soft">
          {mediaTypes.map((m) => (
            <MediaIcon key={m} type={m} size={14} />
          ))}
        </span>
      </span>
      {type !== "simple" && (
        <span className="self-start rounded-[6px] bg-accent-surface px-1.5 py-0.5 text-[11px] font-bold text-accent-strong">
          {t(`questionTypes.${type}`)}
        </span>
      )}
      {cards && image && <MediaView media={image} small className="h-28 w-full object-cover" />}
      <span
        className={cn(
          "text-[13px] leading-snug [overflow-wrap:anywhere]",
          cards ? "line-clamp-3 font-medium" : "line-clamp-2 text-soft",
          !q.text.trim() && "text-faint italic",
        )}
      >
        {q.text.trim() ||
          (q.questionFiles.length
            ? t(`editor.media.${q.questionFiles[0]!.type}`)
            : t("editor.board.noText"))}
      </span>
      {cards && (
        <span
          className={cn(
            "mt-auto line-clamp-2 rounded-[8px] px-2 py-1 text-[12px] font-semibold [overflow-wrap:anywhere]",
            q.answerText.trim() || q.answerFiles.length
              ? "bg-success-surface text-success"
              : "bg-warning-surface text-warning",
          )}
        >
          {q.answerText.trim() ||
            (q.answerFiles.length
              ? t(`editor.media.${q.answerFiles[0]!.type}`)
              : t("editor.preview.noAnswer"))}
        </span>
      )}
      {issue && issue !== "info" && !selected && (
        <span
          className={cn(
            "text-[11px] font-semibold",
            issue === "critical" ? "text-danger" : "text-warning",
          )}
        >
          {t(issue === "critical" ? "editor.board.needsFix" : "editor.board.check")}
        </span>
      )}
    </button>
  );

  return (
    <div
      {...dragSource({ kind: "question", id: q.id })}
      {...drop.props}
      className={cn("group relative", isDragged && "opacity-40")}
    >
      {drop.over && (
        <span
          aria-hidden
          className={cn(
            "absolute top-1 bottom-1 z-10 w-1 rounded-full bg-accent",
            drop.over === "before" ? "-left-1.5" : "-right-1.5",
          )}
        />
      )}
      {cards || drag ? (
        body
      ) : (
        <HoverPreview preview={<QuestionPreview question={q} final={final} compact />}>
          {body}
        </HoverPreview>
      )}
      <div className="absolute top-1.5 right-1.5">
        <Menu
          label={t("editor.board.questionActions", { label })}
          size={32}
          items={[
            {
              label: t("editor.actions.edit"),
              icon: <EditIcon size={16} />,
              onSelect: () => actions.edit(q.id),
            },
            {
              label: t("editor.actions.move"),
              icon: <MoveIcon size={16} />,
              onSelect: () => actions.move(q.id),
            },
            {
              label: t("editor.actions.duplicate"),
              icon: <CopyIcon size={16} />,
              onSelect: () => actions.duplicate(q.id),
            },
            {
              label: t("editor.actions.delete"),
              icon: <TrashIcon size={16} />,
              danger: true,
              onSelect: () => actions.remove(q.id),
            },
          ]}
        />
      </div>
    </div>
  );
}

/**
 * Shows the full question next to a compact card after the pointer rests on
 * it (mouse only; touch and keyboard use the side panel or the editor).
 */
function HoverPreview({ children, preview }: { children: ReactNode; preview: ReactNode }) {
  const anchor = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const clear = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const show = () => {
    const el = anchor.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 340;
    const left =
      r.right + 12 + width < window.innerWidth ? r.right + 12 : Math.max(8, r.left - 12 - width);
    setPos({ top: Math.max(8, Math.min(r.top, window.innerHeight - 420)), left });
  };

  return (
    <div
      ref={anchor}
      className="h-full"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        clear();
        timer.current = window.setTimeout(show, 380);
      }}
      onPointerLeave={() => {
        clear();
        setPos(null);
      }}
      onPointerDown={() => {
        clear();
        setPos(null);
      }}
    >
      {children}
      {pos &&
        createPortal(
          <div
            data-testid="question-hover"
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className="pointer-events-none fixed z-[65] max-h-[min(70vh,560px)] w-[340px] overflow-hidden rounded-md border border-line-strong bg-surface p-4 shadow-2xl oq-pop"
          >
            {preview}
          </div>,
          document.body,
        )}
    </div>
  );
}

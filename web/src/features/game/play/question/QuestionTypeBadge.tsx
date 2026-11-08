import { useEffect, useId, useRef, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import type { QuestionType } from "@/game/protocol";
import { Badge } from "@/ui/Badge";
import "./QuestionTypeBadge.css";

/** Keep type explanations out of the heading, available on hover or keyboard focus. */
export function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const { t } = useTranslation();
  const id = useId();
  const popup = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), [type]);
  if (type === "simple") return null;

  const cancelHover = () => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = undefined;
  };
  const show = () => {
    cancelHover();
    const panel = popup.current;
    const label = trigger.current;
    if (!panel || !label) return;
    const rect = label.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    panel.style.top = `${rect.bottom}px`;
    panel.showPopover?.();
    const above = rect.top - panel.offsetHeight >= 12;
    panel.dataset.side = above ? "above" : "below";
    panel.style.top = `${above ? rect.top - panel.offsetHeight : rect.bottom}px`;
  };
  const leave = (event: SyntheticEvent<HTMLElement, FocusEvent | PointerEvent>) => {
    cancelHover();
    const next = event.nativeEvent.relatedTarget as Node | null;
    if (popup.current?.contains(next) || trigger.current?.contains(next)) return;
    if (event.type === "pointerleave" && document.activeElement === trigger.current) return;
    popup.current?.hidePopover?.();
  };
  return (
    <>
      <span
        ref={trigger}
        tabIndex={0}
        data-testid="question-type-badge"
        aria-describedby={id}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return;
          cancelHover();
          hoverTimer.current = window.setTimeout(show, 300);
        }}
        onPointerDown={(event) => event.preventDefault()}
        onFocus={show}
        onPointerLeave={leave}
        onBlur={leave}
        className="inline-flex shrink-0 cursor-default rounded-[8px] focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Badge tone="info">{t(`questionTypes.${type}`)}</Badge>
      </span>
      <span
        ref={popup}
        id={id}
        popover="auto"
        role="tooltip"
        onPointerLeave={leave}
        className="question-type-tooltip text-left text-sm font-normal leading-relaxed text-text"
      >
        <span className="block max-h-[calc(100dvh-36px)] overflow-y-auto rounded-md border border-line-strong bg-surface-2 p-3 shadow-2xl [overflow-wrap:anywhere]">
          {t(type === "noRisk" ? "question.noRiskHelp" : `editor.form.typeHelp.${type}`)}
        </span>
      </span>
    </>
  );
}

import { useId, useRef, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { questionStyles } from "./questionStyles";

/** Selecting an answer and inspecting its image are separate sibling buttons. */
export function ChoiceOption({
  index,
  text,
  image,
  disabled,
  className,
  onPick,
  onPreview,
  status,
}: {
  index: number;
  text: string;
  image?: string;
  disabled: boolean;
  className: string;
  onPick: () => void;
  onPreview: () => void;
  status?: ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();
  const preview = useRef<HTMLSpanElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const showText = () => {
    const content = preview.current;
    const panel = popup.current;
    if (!content || !panel || content.scrollHeight <= content.clientHeight + 1) return;
    const rect = content.closest("li")!.getBoundingClientRect();
    const width = Math.min(520, window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const placeBelow = below >= above;
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${Math.max(1, Math.min(window.innerHeight * 0.4, placeBelow ? below : above))}px`;
    panel.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    panel.showPopover?.();
    panel.style.top = `${placeBelow ? rect.bottom : rect.top - panel.getBoundingClientRect().height}px`;
  };
  const hideText = (next: EventTarget | null) => {
    if (next instanceof Node && popup.current?.contains(next)) return;
    popup.current?.hidePopover?.();
  };
  return (
    <li
      className={cn("choice-card", className)}
      data-image={!!image}
      data-text={!!text}
      style={
        {
          "--choice-image-width": !text
            ? "100%"
            : text.length < 60
              ? "42%"
              : text.length < 180
                ? "28%"
                : "18%",
        } as CSSProperties
      }
      tabIndex={disabled ? 0 : undefined}
      onFocus={(event) => {
        if (event.target === event.currentTarget) showText();
      }}
      onPointerMove={(event) => {
        if (!(event.target as HTMLElement).closest(".choice-image-button")) showText();
      }}
      onPointerLeave={(e) => hideText(e.relatedTarget)}
    >
      <button
        type="button"
        className="choice-answer"
        disabled={disabled}
        data-option={index + 1}
        aria-label={`${text || t("question.optionNumber", { n: index + 1 })}${status ? `, ${t("judge.wrong")}` : ""}`}
        onClick={onPick}
        onFocus={showText}
        onBlur={(e) => hideText(e.relatedTarget)}
      />
      <kbd className={questionStyles.choiceLetter}>{index + 1}</kbd>
      {text && (
        <span ref={preview} className="choice-preview" onPointerEnter={showText}>
          {text}
          {status}
        </span>
      )}
      {image && (
        <button
          type="button"
          className="choice-image-button"
          onClick={onPreview}
          onPointerEnter={() => popup.current?.hidePopover?.()}
          onFocus={() => popup.current?.hidePopover?.()}
          aria-label={t("question.expandOption", { n: index + 1 })}
        >
          <img src={image} alt="" className="choice-image" />
        </button>
      )}
      {text && (
        <div
          ref={popup}
          id={id}
          popover="auto"
          className="choice-full-text"
          data-no-shortcuts
          onPointerLeave={(e) => hideText(e.relatedTarget)}
        >
          {text}
        </div>
      )}
    </li>
  );
}

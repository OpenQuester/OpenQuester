import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { onChoiceKeyDown } from "@/ui/choiceNavigation";
import "./QuestionLayout.css";

/** Media and text share the remaining stage, never the document's height. */
export function QuestionBody({
  media,
  text,
  textLength = 0,
  label,
  footer,
}: {
  media?: ReactNode;
  text?: ReactNode;
  textLength?: number;
  label?: string;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  const scroll = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [tab, setTab] = useState<"media" | "text">("media");
  const mixed = !!media && !!text;
  useEffect(() => {
    const element = scroll.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => setOverflow(element.scrollHeight > element.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [text]);
  return (
    <div
      className={cn(
        "question-body",
        mixed && "question-body-mixed",
        mixed && textLength > 240 && "question-body-split",
      )}
      data-tab={tab}
      data-short={textLength <= 240}
      data-testid="question-body"
    >
      {mixed && (
        <div className="question-body-tabs" role="tablist" aria-label={t("question.region")}>
          {(["media", "text"] as const).map((view) => (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={tab === view}
              tabIndex={tab === view ? 0 : -1}
              onKeyDown={onChoiceKeyDown}
              onClick={() => setTab(view)}
            >
              {t(view === "media" ? "question.mediaTab" : "question.textTab")}
            </button>
          ))}
        </div>
      )}
      {media && (
        <div className="question-body-media" data-testid="question-media-region">
          {media}
        </div>
      )}
      {text && (
        <section className="question-body-text" aria-label={label ?? t("question.region")}>
          <div className="question-text-label">
            <span>{label ?? t("question.region")}</span>
            {overflow && <span className="question-scroll-hint">{t("question.scrollHint")}</span>}
          </div>
          <div
            ref={scroll}
            className="question-text-scroll"
            tabIndex={overflow ? 0 : undefined}
            data-testid="question-text-scroll"
          >
            <div>{text}</div>
          </div>
          {footer}
        </section>
      )}
    </div>
  );
}

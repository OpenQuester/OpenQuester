import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "./QuestionLayout.css";

export interface QuestionBodyProps {
  media?: ReactNode;
  audio?: ReactNode;
  text?: ReactNode;
  textLength?: number;
  textRevision?: string;
  label?: string;
  footer?: ReactNode;
  controls?: ReactNode;
}

/** One canvas, with separate scroll regions for long text and media. */
export function QuestionBody({
  media,
  audio,
  text,
  textLength = 0,
  textRevision,
  label,
  footer,
  controls,
}: QuestionBodyProps) {
  const { t } = useTranslation();
  const hasText = !!text;
  const scroll = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [textRevision]);

  useEffect(() => {
    const element = scroll.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => setOverflow(element.scrollHeight > element.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [hasText]);

  return (
    <div className="question-body" data-short={textLength <= 240} data-testid="question-body">
      {text && (
        <section className="question-body-text" aria-label={label ?? t("question.region")}>
          {overflow && <div className="question-scroll-hint">{t("question.scrollHint")}</div>}
          <div
            ref={scroll}
            className="question-text-scroll"
            tabIndex={overflow ? 0 : undefined}
            data-testid="question-text-scroll"
          >
            <div>{text}</div>
          </div>
        </section>
      )}
      {(media || audio) && (
        <div className="question-body-material">
          {media && (
            <div className="question-body-media" data-testid="question-media-region">
              {media}
            </div>
          )}
          {audio && (
            <div className="question-body-audio" data-testid="question-audio-region">
              {audio}
            </div>
          )}
        </div>
      )}
      {controls}
      {footer}
    </div>
  );
}

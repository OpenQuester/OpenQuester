import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { onChoiceKeyDown } from "@/ui/choiceNavigation";

/** Keep the media mounted while narrow screens switch between question and options. */
export function ChoiceLayout({
  prompt,
  children,
  count,
}: {
  prompt: ReactNode;
  children: ReactNode;
  count: number;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [tab, setTab] = useState("question");
  return (
    <div className="choice-question" data-tab={tab}>
      <div className="choice-tabs" role="tablist" aria-label={t("question.region")}>
        {["question", "options"].map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={tab === view}
            aria-controls={`${id}-${view}`}
            tabIndex={tab === view ? 0 : -1}
            onKeyDown={onChoiceKeyDown}
            onClick={() => setTab(view)}
          >
            {view === "question" ? t("question.region") : `${t("question.options")} · ${count}`}
          </button>
        ))}
      </div>
      <div id={`${id}-question`} className="choice-prompt">
        {prompt}
      </div>
      <section id={`${id}-options`} className="choice-options" aria-label={t("question.options")}>
        <div className="question-text-label">
          <span>
            {t("question.options")} · {count}
          </span>
        </div>
        {children}
      </section>
    </div>
  );
}

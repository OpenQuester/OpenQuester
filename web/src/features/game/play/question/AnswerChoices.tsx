import { questionStyles } from "./questionStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useAnswerChoices } from "./useAnswerChoices";
import { mapUrl } from "@/lib/urlMappings";

export function AnswerChoices() {
  const { t } = useTranslation();
  const { visible, answers, correct, answering, locked, picked, pick } = useAnswerChoices();
  if (!visible) return <p className="m-0 text-muted">{t("question.optionsSoon")}</p>;

  return (
    <ol className={questionStyles.choices} aria-label={t("question.options")}>
      {answers.map((a, i) => {
        const text = a.text ?? "";
        const isCorrect = correct != null && text.trim().toLowerCase() === correct;
        return (
          <li key={a.id ?? i}>
            <button
              type="button"
              disabled={!answering || locked}
              data-option={i + 1}
              aria-label={text || t("question.optionNumber", { n: i + 1 })}
              onClick={() => pick(a, i)}
              className={cn(
                questionStyles.choice,
                picked === i && locked
                  ? "border-accent bg-accent-surface"
                  : isCorrect
                    ? "border-success-line bg-success-surface"
                    : "border-line-strong bg-surface-2",
                answering && !locked ? "hover:border-accent" : "cursor-default",
              )}
            >
              <kbd className={questionStyles.choiceLetter}>{i + 1}</kbd>
              <span className="[overflow-wrap:anywhere]">{text}</span>
              {a.file?.link && (
                <img
                  src={mapUrl(a.file.link)}
                  alt=""
                  className="ml-auto h-12 w-12 rounded object-cover"
                />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

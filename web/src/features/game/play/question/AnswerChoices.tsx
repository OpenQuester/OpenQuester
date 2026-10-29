import { questionStyles } from "./questionStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useAnswerChoices } from "./useAnswerChoices";
import { mapUrl } from "@/lib/urlMappings";

export function AnswerChoices() {
  const { t } = useTranslation();
  const { visible, answers, correct, correctOrder, answering, locked, picked, pick, rejected } =
    useAnswerChoices();
  if (!visible) return <p className="m-0 text-muted">{t("question.optionsSoon")}</p>;

  return (
    <ol className={questionStyles.choices} aria-label={t("question.options")}>
      {answers.map((a, i) => {
        const text = a.text ?? "";
        const isCorrect =
          correctOrder != null
            ? a.order === correctOrder
            : correct != null && text.trim().toLowerCase() === correct;
        const isRejected = rejected.has(a.order);
        return (
          <li key={a.id ?? i}>
            <button
              type="button"
              disabled={!answering || locked || isRejected}
              data-option={i + 1}
              aria-label={`${text || t("question.optionNumber", { n: i + 1 })}${isRejected ? `, ${t("judge.wrong")}` : ""}`}
              onClick={() => pick(a, i)}
              className={cn(
                questionStyles.choice,
                isRejected
                  ? "border-danger/50 bg-danger-surface text-on-danger-surface"
                  : picked === i && locked
                    ? "border-accent bg-accent-surface"
                    : isCorrect
                      ? "border-success-line bg-success-surface"
                      : "border-line-strong bg-surface-2",
                answering && !locked && !isRejected ? "hover:border-accent" : "cursor-default",
              )}
            >
              <kbd className={questionStyles.choiceLetter}>{i + 1}</kbd>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {text}
                {isRejected && (
                  <span className="block text-sm font-semibold">{t("judge.wrong")}</span>
                )}
              </span>
              {a.file?.link && (
                <img
                  src={mapUrl(a.file.link)}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded object-cover"
                />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

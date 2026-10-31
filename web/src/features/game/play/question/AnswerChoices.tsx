import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useAnswerChoices } from "./useAnswerChoices";
import { useState, type CSSProperties } from "react";
import { Dialog } from "@/ui/Dialog";
import { ChoiceOption } from "./ChoiceOption";

export function AnswerChoices() {
  const { t } = useTranslation();
  const { visible, answers, correct, correctOrder, answering, locked, picked, pick, rejected } =
    useAnswerChoices();
  const [expanded, setExpanded] = useState<number | null>(null);
  const detail = expanded == null ? null : answers[expanded];
  if (!visible) return <p className="m-0 text-muted">{t("question.optionsSoon")}</p>;

  return (
    <>
      <ol
        className="answer-choices"
        aria-label={t("question.options")}
        data-compact={answers.every(
          (answer) => !answer.file?.link && (answer.text?.length ?? 0) <= 80,
        )}
        style={{ "--choice-rows": Math.ceil(answers.length / 2) } as CSSProperties}
      >
        {answers.map((a, i) => {
          const text = a.text ?? "";
          const isCorrect =
            correctOrder != null
              ? a.order === correctOrder
              : correct != null && text.trim().toLowerCase() === correct;
          const isRejected = rejected.has(a.order);
          return (
            <ChoiceOption
              key={a.id ?? a.order}
              index={i}
              text={text}
              image={a.file?.link ?? undefined}
              disabled={!answering || locked || isRejected}
              onPick={() => pick(a, i)}
              onPreview={() => setExpanded(i)}
              className={cn(
                isRejected
                  ? "border-danger/50 bg-danger-surface text-on-danger-surface"
                  : picked === i && locked
                    ? "border-accent bg-accent-surface"
                    : isCorrect
                      ? "border-success-line bg-success-surface"
                      : "border-line-strong bg-surface-2",
                answering && !locked && !isRejected ? "hover:border-accent" : "cursor-default",
              )}
              status={
                isRejected && (
                  <span className="block text-sm font-semibold">{t("judge.wrong")}</span>
                )
              }
            />
          );
        })}
      </ol>
      <Dialog
        open={detail != null}
        onOpenChange={(open) => {
          if (!open) setExpanded(null);
        }}
        title={t("question.optionNumber", { n: (expanded ?? 0) + 1 })}
        closeLabel={t("common.close")}
      >
        {detail && (
          <div className="flex min-h-0 flex-1 items-center justify-center p-3">
            {detail.file?.link && (
              <img
                src={detail.file.link}
                alt={detail.text ?? ""}
                className="max-h-[65dvh] max-w-full object-contain"
              />
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}

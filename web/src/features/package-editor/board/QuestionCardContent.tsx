import { packageBoardStyles, questionCardHeight } from "./packageBoardStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { CopyIcon, EditIcon, MoveIcon, TrashIcon } from "@/ui/icons";
import { Menu } from "@/ui/Menu";
import { MediaIcon, AttachmentPreview } from "../AttachmentPreview";
import type { CardActions, QuestionCardProps } from "../QuestionCard";
import { correctChoice } from "../choiceCorrectness";

import type { useQuestionCard } from "./useQuestionCard";

export function QuestionCardContent({
  question: q,
  final,
  issue,
  actions,
  card,
}: Omit<QuestionCardProps, "index"> & { card: ReturnType<typeof useQuestionCard> }) {
  const { t } = useTranslation();
  const { selected, readOnly, cards, type, image, mediaTypes, label } = card;
  const choiceImage = !final && q.type === "choice" ? correctChoice(q)?.file : null;
  const mainText = q.text.trim();
  const extraText = q.textItems?.find((item) => item.text.trim())?.text;
  const hasText = !!(mainText || extraText);
  const questionSummary =
    mainText ||
    extraText ||
    (q.questionFiles.length
      ? t(`editor.media.${q.questionFiles[0]!.type}`)
      : t("editor.board.noText"));
  const answerText = q.answerText.trim();
  const hasAnswer = !!(answerText || q.answerFiles.length || choiceImage);
  const answerSummary =
    answerText ||
    (q.answerFiles.length || choiceImage
      ? t(`editor.media.${q.answerFiles[0]?.type ?? choiceImage?.type}`)
      : t("editor.preview.noAnswer"));
  return (
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
        packageBoardStyles.question,
        selected
          ? "border-accent bg-accent-surface"
          : issue === "critical"
            ? "border-danger-strong/70 bg-danger-surface"
            : "border-line bg-surface-2 hover:border-line-strong",
        questionCardHeight(cards),
      )}
    >
      <span className={cn("flex items-center gap-2", !readOnly && "pr-7")}>
        {!final && (
          <span
            className={cn(
              packageBoardStyles.questionPrice,
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
        <span className={packageBoardStyles.questionType}>{t(`questionTypes.${type}`)}</span>
      )}
      {cards && image && (
        <AttachmentPreview media={image} small className="h-28 w-full object-cover" />
      )}
      <span
        className={cn(
          "text-[13px] leading-snug [overflow-wrap:anywhere]",
          cards ? "line-clamp-3 font-medium" : "line-clamp-2 text-soft",
          !hasText && "text-faint italic",
        )}
      >
        {questionSummary}
      </span>
      {cards && (
        <span
          className={cn(
            packageBoardStyles.questionAnswer,
            hasAnswer ? "bg-success-surface text-success" : "bg-warning-surface text-warning",
          )}
        >
          {answerSummary}
        </span>
      )}
      {issue && issue !== "info" && !selected && (
        <span
          className={cn(
            "text-[12px] font-semibold",
            issue === "critical" ? "text-danger" : "text-warning",
          )}
        >
          {t(issue === "critical" ? "editor.board.needsFix" : "editor.board.check")}
        </span>
      )}
    </button>
  );
}
export function QuestionCardMenu({
  id,
  label,
  actions,
}: {
  id: string;
  label: string;
  actions: CardActions;
}) {
  const { t } = useTranslation();
  return (
    <Menu
      label={t("editor.board.questionActions", { label })}
      size={32}
      items={[
        {
          label: t("editor.actions.edit"),
          icon: <EditIcon size={16} />,
          onSelect: () => actions.edit(id),
        },
        {
          label: t("editor.actions.move"),
          icon: <MoveIcon size={16} />,
          onSelect: () => actions.move(id),
        },
        {
          label: t("editor.actions.duplicate"),
          icon: <CopyIcon size={16} />,
          onSelect: () => actions.duplicate(id),
        },
        {
          label: t("editor.actions.delete"),
          icon: <TrashIcon size={16} />,
          danger: true,
          onSelect: () => actions.remove(id),
        },
      ]}
    />
  );
}

import { packageBoardStyles } from "./board/packageBoardStyles";
import { cn } from "@/lib/cn";
import { dragSource } from "./packageDragDrop";
import type { DraftQuestion } from "./packageDraft";
import { QuestionPreview } from "./QuestionPreview";
import type { ValidationSeverity } from "./validatePackage";
import { QuestionHoverPreview } from "./board/QuestionHoverPreview";
import { QuestionCardContent, QuestionCardMenu } from "./board/QuestionCardContent";
import { useQuestionCard } from "./board/useQuestionCard";

export interface CardActions {
  open: (id: string) => void;
  edit: (id: string) => void;
  move: (id: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  dropQuestion: (questionId: string, beforeIndex: number) => void;
}

export interface QuestionCardProps {
  question: DraftQuestion;
  index: number;
  final: boolean;
  issue?: ValidationSeverity;
  actions: CardActions;
}
export function QuestionCard(props: QuestionCardProps) {
  const { question: q, final, issue, actions } = props;
  const card = useQuestionCard(props);
  const { readOnly, isDragged, drop, cards, drag, label } = card;
  const body = (
    <QuestionCardContent question={q} final={final} issue={issue} actions={actions} card={card} />
  );
  return (
    <div
      {...dragSource({ kind: "question", id: q.id }, !readOnly)}
      {...drop.props}
      className={cn("group relative", isDragged && "opacity-40")}
    >
      {drop.over && (
        <span
          aria-hidden
          className={cn(
            packageBoardStyles.questionInsertion,
            drop.over === "before" ? "-left-1.5" : "-right-1.5",
          )}
        />
      )}
      {cards || drag ? (
        body
      ) : (
        <QuestionHoverPreview preview={<QuestionPreview question={q} final={final} compact />}>
          {body}
        </QuestionHoverPreview>
      )}
      <div className="absolute top-1.5 right-1.5">
        {!readOnly && <QuestionCardMenu id={q.id} label={label} actions={actions} />}
      </div>
    </div>
  );
}

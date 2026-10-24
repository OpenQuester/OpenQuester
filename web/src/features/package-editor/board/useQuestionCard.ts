import { useTranslation } from "react-i18next";
import { useDragging, useDropTarget, type Edge } from "../packageDragDrop";
import { usePackageEditor } from "../packageEditorStore";
import type { QuestionCardProps } from "../QuestionCard";

export function useQuestionCard({ question: q, index, final, actions }: QuestionCardProps) {
  const { t } = useTranslation();
  const density = usePackageEditor((s) => s.density);
  const selected = usePackageEditor((s) => s.selectedId === q.id);
  const drag = useDragging();
  const readOnly = usePackageEditor((s) => s.readOnly);
  const isDragged = drag?.kind === "question" && drag.id === q.id;
  const drop = useDropTarget({
    accepts: (d) => !readOnly && d.kind === "question" && d.id !== q.id,
    axis: "x",
    onDrop: (d, edge: Edge) => actions.dropQuestion(d.id, edge === "before" ? index : index + 1),
  });
  const cards = density === "cards";
  const type = final ? "simple" : q.type;
  const image = q.questionFiles.find((m) => m.type === "image");
  const mediaTypes = [...new Set([...q.questionFiles, ...q.answerFiles].map((m) => m.type))];
  const label = [
    final ? "" : String(q.price ?? ""),
    type !== "simple" ? t(`questionTypes.${type}`) : "",
    q.text,
  ]
    .filter(Boolean)
    .join(" · ");

  return { selected, drag, readOnly, isDragged, drop, cards, type, image, mediaTypes, label };
}

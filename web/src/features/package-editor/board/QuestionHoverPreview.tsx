import { packageBoardStyles } from "./packageBoardStyles";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuestionHoverPreview } from "./useQuestionHoverPreview";

export function QuestionHoverPreview({
  children,
  preview,
}: {
  children: ReactNode;
  preview: ReactNode;
}) {
  const { anchor, pos, ...events } = useQuestionHoverPreview();
  return (
    <div ref={anchor} className="h-full" {...events}>
      {children}
      {pos &&
        createPortal(
          <div
            data-testid="question-hover"
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className={packageBoardStyles.hoverPreview}
          >
            {preview}
          </div>,
          document.body,
        )}
    </div>
  );
}

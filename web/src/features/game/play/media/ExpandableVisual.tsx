import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { CloseIcon } from "@/ui/icons";

/** The same media element remains in place when its native dialog enters the top layer. */
export function ExpandableVisual({
  children,
  suspended = false,
}: {
  children: ReactNode;
  suspended?: boolean;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (suspended && dialog.current?.open) dialog.current.close();
  }, [suspended]);
  const label = t(expanded ? "question.closeMedia" : "question.expandMedia");
  return (
    <div className="question-visual-cell">
      <dialog
        ref={dialog}
        className="question-expandable"
        style={{ display: "flex" }}
        role={expanded ? undefined : "presentation"}
        aria-label={expanded ? t("question.mediaTab") : undefined}
        onClose={() => {
          setExpanded(false);
          button.current?.focus();
        }}
      >
        {children}
        <button
          ref={button}
          type="button"
          disabled={suspended}
          className="question-expand-button"
          aria-label={label}
          title={label}
          onClick={() => {
            if (dialog.current?.open) {
              dialog.current.close();
            } else {
              dialog.current?.showModal();
              setExpanded(true);
            }
          }}
        >
          {expanded ? <CloseIcon size={18} /> : <span aria-hidden="true">⛶</span>}
        </button>
      </dialog>
    </div>
  );
}

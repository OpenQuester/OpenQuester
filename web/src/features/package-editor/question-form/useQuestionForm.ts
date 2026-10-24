import { useState } from "react";
import { useStagedMedia } from "../media-editor/useStagedMedia";
import type { DraftQuestion } from "../packageDraft";
import * as ops from "../packageOperations";
import { usePackageEditor } from "../packageEditorStore";
export function useQuestionForm(at: ops.QuestionPath, onClose: () => void) {
  const apply = usePackageEditor((s) => s.apply);
  const final = at.round.type === "final";
  const [q, setQ] = useState<DraftQuestion>(at.question);
  const [confirmClose, setConfirmClose] = useState(false);
  const media = useStagedMedia();
  const dirty = q !== at.question;
  const set = (patch: Partial<DraftQuestion>) => setQ((prev) => ({ ...prev, ...patch }));

  const save = () => {
    if (media.active) return;
    if (dirty)
      apply(
        (p) => ops.updateQuestion(p, q.id, q),
        { key: "questionSaved" },
        media.pending.values(),
      );
    onClose();
  };
  const requestClose = () =>
    media.active ? media.closeRef.current?.() : dirty ? setConfirmClose(true) : onClose();

  const onGeometryChange = (index: number) => {
    if (q.answerType !== "point" || q.questionFiles.findIndex((f) => f.type === "image") !== index)
      return;
    const old = q.answerPoint;
    setQ((prev) => ({ ...prev, answerPoint: null }));
    return () => setQ((prev) => ({ ...prev, answerPoint: prev.answerPoint ?? old }));
  };
  return {
    q,
    setQ,
    set,
    final,
    confirmClose,
    setConfirmClose,
    media,
    save,
    requestClose,
    onGeometryChange,
  };
}
export type QuestionFormState = ReturnType<typeof useQuestionForm>;

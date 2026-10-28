import { useState, type Dispatch, type SetStateAction } from "react";
import { useStagedMedia } from "../media-editor/useStagedMedia";
import type { DraftQuestion } from "../packageDraft";
import * as ops from "../packageOperations";
import { usePackageEditor } from "../packageEditorStore";
import type { MediaChange, MediaUndo } from "./questionMediaHistory";
export function useQuestionForm(at: ops.QuestionPath, onClose: () => void) {
  const apply = usePackageEditor((s) => s.apply);
  const final = at.round.type === "final";
  const [draft, setDraft] = useState<{ q: DraftQuestion; undo: MediaUndo | null }>({
    q: at.question,
    undo: null,
  });
  const { q } = draft;
  const setQ: Dispatch<SetStateAction<DraftQuestion>> = (update) =>
    setDraft((prev) => ({
      ...prev,
      q: typeof update === "function" ? update(prev.q) : update,
    }));
  const applyMedia = (change: MediaChange) =>
    setDraft((prev) => {
      const result = change(prev.q);
      return result ? { q: result.question, undo: result.undo } : prev;
    });
  const undoMedia = () =>
    setDraft((prev) => (prev.undo ? { q: prev.undo(prev.q), undo: null } : prev));
  const [revealText, setRevealText] = useState(() => String(at.question.showAnswerDuration / 1000));
  const [confirmClose, setConfirmClose] = useState(false);
  const media = useStagedMedia();
  const dirty = q !== at.question || revealText !== String(at.question.showAnswerDuration / 1000);
  const set = (patch: Partial<DraftQuestion>) => setQ((prev) => ({ ...prev, ...patch }));
  const revealSeconds = Number(revealText.replace(",", "."));
  const revealValid =
    revealText.trim() !== "" &&
    Number.isFinite(revealSeconds) &&
    revealSeconds >= 2 &&
    revealSeconds <= 30;
  const canSave = q.answerFiles.length > 0 || revealValid;
  const changeReveal = (value: string) => {
    setRevealText(value);
    const number = Number(value.replace(",", "."));
    if (value.trim() !== "" && Number.isFinite(number))
      set({ showAnswerDuration: Math.round(number * 1000) });
  };

  const save = () => {
    if (media.active || !canSave) return;
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

  return {
    q,
    setQ,
    set,
    final,
    confirmClose,
    setConfirmClose,
    media,
    revealText,
    revealValid,
    canSave,
    changeReveal,
    save,
    requestClose,
    applyMedia,
    undoMedia,
    hasMediaUndo: !!draft.undo,
  };
}
export type QuestionFormState = ReturnType<typeof useQuestionForm>;

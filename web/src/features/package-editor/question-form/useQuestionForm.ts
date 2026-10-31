import { useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { useStagedMedia } from "../media-editor/useStagedMedia";
import { newId, type DraftMedia, type DraftQuestion } from "../packageDraft";
import * as ops from "../packageOperations";
import { usePackageEditor } from "../packageEditorStore";
import { automaticPointTarget, type MediaChange, type MediaUndo } from "./questionMediaHistory";
import { questionSteps, syncQuestionFiles, withQuestionSteps } from "./questionTimeline";
export function useQuestionForm(at: ops.QuestionPath, onClose: () => void) {
  const { t } = useTranslation();
  const apply = usePackageEditor((s) => s.apply);
  const final = at.round.type === "final";
  const [draft, setDraft] = useState<{
    q: DraftQuestion;
    baseline: DraftQuestion;
    needsMainFirst: boolean;
    undo: MediaUndo | null;
  }>(() => {
    const identify = (files: DraftMedia[]) => {
      const ids = new Set<string>();
      return files.map((file) => {
        const id = file.occurrenceId && !ids.has(file.occurrenceId) ? file.occurrenceId : newId();
        ids.add(id);
        return { ...file, occurrenceId: id };
      });
    };
    const questionFiles = identify(at.question.questionFiles);
    const identified = {
      ...at.question,
      questionFiles,
      answerFiles: identify(at.question.answerFiles),
      ...(at.question.answerPoint && at.question.pointImageId === undefined
        ? { pointImageId: questionFiles.find((file) => file.type === "image")?.occurrenceId ?? "" }
        : {}),
    };
    const normalize = identified.mainTextFirst !== true || identified.textPosition !== 0;
    const needsMainFirst = !!identified.text.trim() && (normalize || identified.textItems == null);
    const q =
      normalize || needsMainFirst
        ? withQuestionSteps(
            {
              ...identified,
              mainTextFirst: true,
              textItems: identified.textItems ?? (identified.text.trim() ? [] : undefined),
            },
            [{ kind: "main" }, ...questionSteps(identified).filter((step) => step.kind !== "main")],
          )
        : identified;
    return { q, baseline: q, undo: null, needsMainFirst };
  });
  const { q } = draft;
  const setQ: Dispatch<SetStateAction<DraftQuestion>> = (update) =>
    setDraft((prev) => ({
      ...prev,
      q: typeof update === "function" ? update(prev.q) : update,
    }));
  const applyChange = (change: MediaChange, timeline: boolean) =>
    setDraft((prev) => {
      const raw = change(prev.q);
      if (!raw) return prev;
      const result = automaticPointTarget(prev.q, raw);
      const previousSteps = questionSteps(prev.q);
      return {
        ...prev,
        q: timeline ? result.question : syncQuestionFiles(prev.q, result.question),
        undo: (current) =>
          timeline
            ? result.undo(current)
            : syncQuestionFiles(current, result.undo(current), previousSteps),
      };
    });
  const applyMedia = (change: MediaChange) => applyChange(change, false);
  const applyTimeline = (change: MediaChange) => applyChange(change, true);
  const undoMedia = () => {
    if (!draft.undo) return false;
    if (
      draft.undo &&
      draft.q.answerPoint &&
      draft.undo(draft.q).answerPoint !== draft.q.answerPoint &&
      !window.confirm(t("editor.media.pointUndoConfirm"))
    )
      return false;
    setDraft((prev) => (prev.undo ? { ...prev, q: prev.undo(prev.q), undo: null } : prev));
    return true;
  };
  const [revealText, setRevealText] = useState(() => String(at.question.showAnswerDuration / 1000));
  const [confirmClose, setConfirmClose] = useState(false);
  const media = useStagedMedia();
  const dirty =
    q !== draft.baseline || revealText !== String(at.question.showAnswerDuration / 1000);
  const set = (patch: Partial<DraftQuestion>) =>
    setQ((prev) => {
      const next = {
        ...prev,
        ...patch,
        ...(patch.text !== undefined && at.question.textItems == null && !prev.textItems?.length
          ? { textItems: patch.text.trim() ? [] : undefined }
          : {}),
      };
      if (patch.answerType !== "point" || prev.answerType === "point") return next;
      const target = prev.questionFiles.filter((file) => file.type === "image").at(-1);
      const previous =
        prev.pointImageId !== undefined || prev.answerPoint
          ? (prev.questionFiles.find((file) => file.occurrenceId === prev.pointImageId) ??
            (prev.pointImageId === undefined
              ? prev.questionFiles.find((file) => file.type === "image")
              : undefined))
          : target;
      return {
        ...next,
        pointImageId: target?.occurrenceId ?? "",
        ...(previous?.occurrenceId !== target?.occurrenceId ? { answerPoint: null } : {}),
      };
    });
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
    if (dirty || draft.needsMainFirst)
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
    applyTimeline,
    undoMedia,
    hasMediaUndo: !!draft.undo,
  };
}
export type QuestionFormState = ReturnType<typeof useQuestionForm>;

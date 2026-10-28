import type { DraftMedia, DraftQuestion } from "../packageDraft";
import type { FileRef } from "@/features/upload/types";

export type MediaUndo = (question: DraftQuestion) => DraftQuestion;
export type MediaChange = (question: DraftQuestion) => {
  question: DraftQuestion;
  undo: MediaUndo;
} | null;
export type ApplyMediaChange = (change: MediaChange) => void;
export type MediaSlot = "questionFiles" | "answerFiles";

export function changeChoiceMedia(id: string, file: FileRef | null): MediaChange {
  return (question) => {
    const option = question.options.find((item) => item.id === id);
    if (!option) return null;
    const update = (current: DraftQuestion, value: FileRef | null) => {
      if (!current.options.some((item) => item.id === id)) return current;
      return {
        ...current,
        options: current.options.map((item) => (item.id === id ? { ...item, file: value } : item)),
      };
    };
    return { question: update(question, file), undo: (current) => update(current, option.file) };
  };
}

/** Restore a single occurrence without replacing other question edits. */
export function changeMedia(
  slot: MediaSlot,
  operation:
    | { kind: "add"; file: DraftMedia }
    | { kind: "remove"; index: number }
    | {
        kind: "edit";
        index: number;
        original: DraftMedia;
        file: DraftMedia;
        geometryChanged: boolean;
      },
): MediaChange {
  return (question) => {
    const files = question[slot];
    const index = operation.kind === "add" ? files.length : operation.index;
    const original = files[index];
    if (operation.kind !== "add" && !original) return null;
    if (operation.kind === "edit" && original?.md5 !== operation.original.md5) return null;
    const geometryChanged =
      slot === "questionFiles" &&
      files.findIndex((file) => file.type === "image") === index &&
      (operation.kind === "remove" || (operation.kind === "edit" && operation.geometryChanged));
    const oldPoint = geometryChanged ? question.answerPoint : null;
    const next = [...files];
    if (operation.kind === "add") next.push(operation.file);
    else if (operation.kind === "remove") next.splice(index, 1);
    else next[index] = { ...original!, md5: operation.file.md5, type: operation.file.type };
    const nextFile = next[index];
    return {
      question: { ...question, [slot]: next, ...(geometryChanged ? { answerPoint: null } : {}) },
      undo: (current) => {
        const restored = [...current[slot]];
        if (operation.kind === "remove")
          restored.splice(Math.min(index, restored.length), 0, original!);
        else if (operation.kind === "add") {
          if (restored[index]?.md5 !== operation.file.md5) return current;
          restored.splice(index, 1);
        } else {
          if (restored[index]?.md5 !== nextFile?.md5) return current;
          restored[index] = { ...restored[index]!, md5: original!.md5, type: original!.type };
        }
        const removedAddedPointImage =
          slot === "questionFiles" &&
          operation.kind === "add" &&
          current[slot].findIndex((file) => file.type === "image") === index;
        return {
          ...current,
          [slot]: restored,
          ...(geometryChanged
            ? { answerPoint: current.answerPoint == null ? oldPoint : null }
            : {}),
          ...(removedAddedPointImage ? { answerPoint: null } : {}),
        };
      },
    };
  };
}

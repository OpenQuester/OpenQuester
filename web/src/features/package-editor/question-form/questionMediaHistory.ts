import { draftPointImage, type DraftMedia, type DraftQuestion } from "../packageDraft";
import type { FileRef } from "@/features/upload/types";

export type MediaUndo = (question: DraftQuestion) => DraftQuestion;
export type MediaChange = (question: DraftQuestion) => {
  question: DraftQuestion;
  undo: MediaUndo;
} | null;
export type ApplyMediaChange = (change: MediaChange) => void;
export type MediaSlot = "questionFiles" | "answerFiles";

const lastImage = (question: DraftQuestion) =>
  question.questionFiles.filter((file) => file.type === "image").at(-1);

/** Select the last image when the image sequence changes, preserving legacy targets on open. */
export function automaticPointTarget(
  before: DraftQuestion,
  change: NonNullable<ReturnType<MediaChange>>,
) {
  const after = change.question;
  if (before.answerType !== "point" || after.answerType !== "point") return change;
  const ids = (q: DraftQuestion) =>
    q.questionFiles.filter((file) => file.type === "image").map((file) => file.occurrenceId);
  const previous = ids(before);
  const next = ids(after);
  if (previous.length === next.length && previous.every((id, i) => id === next[i])) return change;
  const oldTarget =
    before.pointImageId !== undefined || before.answerPoint
      ? draftPointImage(before)
      : lastImage(before);
  const target = lastImage(after);
  const targetChanged = oldTarget?.occurrenceId !== target?.occurrenceId;
  const question = {
    ...after,
    pointImageId: target?.occurrenceId ?? "",
    answerPoint: targetChanged ? null : before.answerPoint,
  };
  return {
    question,
    undo: (current: DraftQuestion) => {
      const restored = change.undo(current);
      if (!targetChanged)
        return { ...restored, pointImageId: before.pointImageId, answerPoint: current.answerPoint };
      return {
        ...restored,
        pointImageId: before.pointImageId,
        answerPoint: before.answerPoint,
        answerDeviation: before.answerDeviation,
      };
    },
  };
}

/** Move one occurrence to a final index without changing the file itself. */
export function moveMedia(files: DraftMedia[], id: string, destination: number): DraftMedia[] {
  const from = files.findIndex((file) => file.occurrenceId === id);
  if (from < 0 || !Number.isInteger(destination)) return files;
  const to = Math.max(0, Math.min(destination, files.length - 1));
  if (from === to) return files;
  const next = [...files];
  const [file] = next.splice(from, 1);
  next.splice(to, 0, file!);
  return next;
}

const firstImage = (files: DraftMedia[]) => files.find((file) => file.type === "image")?.md5;

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
    | { kind: "remove"; index: number; occurrenceId?: string }
    | {
        kind: "move";
        occurrenceId: string;
        destination: number;
        expectedImage?: string;
        expectedPoint?: DraftQuestion["answerPoint"];
      }
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
    if (operation.kind === "move") {
      if (
        slot === "questionFiles" &&
        "expectedPoint" in operation &&
        (question.answerPoint !== operation.expectedPoint ||
          firstImage(files) !== operation.expectedImage)
      )
        return null;
      const index = files.findIndex((file) => file.occurrenceId === operation.occurrenceId);
      const next = moveMedia(files, operation.occurrenceId, operation.destination);
      if (next === files) return null;
      const before = files[index - 1]?.occurrenceId;
      const after = files[index + 1]?.occurrenceId;
      const oldImage = firstImage(files);
      const changedPointImage =
        slot === "questionFiles" &&
        question.pointImageId === undefined &&
        oldImage !== firstImage(next);
      const oldPoint = changedPointImage ? question.answerPoint : null;
      return {
        question: {
          ...question,
          [slot]: next,
          ...(changedPointImage ? { answerPoint: null } : {}),
        },
        undo: (current) => {
          const list = current[slot];
          const from = list.findIndex((file) => file.occurrenceId === operation.occurrenceId);
          if (from < 0) return current;
          const rest = list.filter((_, i) => i !== from);
          const nextIndex = after ? rest.findIndex((file) => file.occurrenceId === after) : -1;
          const previousIndex = before
            ? rest.findIndex((file) => file.occurrenceId === before)
            : -1;
          const at =
            nextIndex >= 0
              ? nextIndex
              : previousIndex >= 0
                ? previousIndex + 1
                : Math.min(index, rest.length);
          rest.splice(at, 0, list[from]!);
          const changesImage =
            slot === "questionFiles" &&
            current.pointImageId === undefined &&
            firstImage(list) !== firstImage(rest);
          const point = changesImage
            ? current.answerPoint == null && firstImage(rest) === oldImage
              ? oldPoint
              : null
            : current.answerPoint;
          return { ...current, [slot]: rest, answerPoint: point };
        },
      };
    }
    const index =
      operation.kind === "add"
        ? files.length
        : (operation.kind === "edit" ? operation.original.occurrenceId : operation.occurrenceId)
          ? files.findIndex(
              (file) =>
                file.occurrenceId ===
                (operation.kind === "edit"
                  ? operation.original.occurrenceId
                  : operation.occurrenceId),
            )
          : operation.index;
    const original = files[index];
    if (operation.kind !== "add" && !original) return null;
    if (operation.kind === "edit" && original?.md5 !== operation.original.md5) return null;
    const geometryChanged =
      slot === "questionFiles" &&
      (question.pointImageId !== undefined
        ? files[index]?.occurrenceId === question.pointImageId
        : files.findIndex((file) => file.type === "image") === index) &&
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
          const addedIndex = operation.file.occurrenceId
            ? restored.findIndex((file) => file.occurrenceId === operation.file.occurrenceId)
            : index;
          if (restored[addedIndex]?.md5 !== operation.file.md5) return current;
          restored.splice(addedIndex, 1);
        } else {
          const editedIndex = original!.occurrenceId
            ? restored.findIndex((file) => file.occurrenceId === original!.occurrenceId)
            : index;
          if (restored[editedIndex]?.md5 !== nextFile?.md5) return current;
          restored[editedIndex] = {
            ...restored[editedIndex]!,
            md5: original!.md5,
            type: original!.type,
          };
        }
        const removedAddedPointImage =
          slot === "questionFiles" &&
          operation.kind === "add" &&
          (current.pointImageId !== undefined
            ? current.pointImageId === operation.file.occurrenceId
            : operation.file.occurrenceId
              ? current[slot].find((file) => file.type === "image")?.occurrenceId ===
                operation.file.occurrenceId
              : current[slot].findIndex((file) => file.type === "image") === index);
        return {
          ...current,
          [slot]: restored,
          ...(geometryChanged && current.pointImageId === question.pointImageId
            ? { answerPoint: current.answerPoint == null ? oldPoint : null }
            : {}),
          ...(removedAddedPointImage ? { answerPoint: null } : {}),
        };
      },
    };
  };
}

import { produce } from "immer";
import { create } from "zustand";

export type QuestionType =
  "simple" | "choice" | "no-risk" | "stake" | "secret" | "hidden";
export type EditorQuestion = {
  id: string;
  order: number;
  price: number | null;
  type: QuestionType;
  text: string;
  answer: string;
  choices: string[];
  media: EditorMedia[];
};
export type EditorTheme = {
  id: string;
  order: number;
  name: string;
  description: string;
  questions: EditorQuestion[];
};
export type EditorRound = {
  id: string;
  order: number;
  name: string;
  description: string;
  type: "standard" | "final";
  themes: EditorTheme[];
};
export type EditorMedia = {
  id: string;
  hash?: string;
  type: "image" | "audio" | "video";
  name: string;
  size: number;
  url?: string;
  file?: File;
  data?: ArrayBuffer;
};
export type EditorPackage = {
  id?: number;
  title: string;
  description: string;
  language: string;
  ageRestriction: "NONE" | "A12" | "A16" | "A18";
  status: "draft" | "published";
  rounds: EditorRound[];
};
export type EditorSelection = {
  roundId: string;
  themeId?: string;
  questionId?: string;
};
export type HealthIssue = {
  id: string;
  severity: "critical" | "warning" | "info";
  messageKey: string;
  selection?: EditorSelection;
};

type Snapshot = Pick<EditorState, "document" | "selection" | "selectedIds">;
type EditorState = {
  document: EditorPackage;
  selection: EditorSelection;
  selectedIds: string[];
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  dirty: boolean;
  saving: boolean;
  progress: number | null;
  issues: HealthIssue[];
  replace: (document: EditorPackage) => void;
  select: (selection: EditorSelection, additive?: boolean) => void;
  updatePackage: (patch: Partial<EditorPackage>) => void;
  updateRound: (id: string, patch: Partial<EditorRound>) => void;
  updateTheme: (
    roundId: string,
    id: string,
    patch: Partial<EditorTheme>,
  ) => void;
  updateQuestion: (
    roundId: string,
    themeId: string,
    id: string,
    patch: Partial<EditorQuestion>,
  ) => void;
  addRound: () => void;
  addTheme: (roundId: string) => void;
  addQuestion: (roundId: string, themeId: string) => void;
  duplicateSelection: () => void;
  removeSelection: () => void;
  moveTheme: (themeId: string, targetRoundId: string) => void;
  moveQuestion: (
    questionId: string,
    targetRoundId: string,
    targetThemeId?: string,
    beforeQuestionId?: string,
  ) => void;
  undo: () => void;
  redo: () => void;
  markSaved: (status?: EditorPackage["status"]) => void;
  setSaving: (saving: boolean, progress?: number | null) => void;
};

const uid = () => crypto.randomUUID();
const question = (
  order: number,
  price = (order + 1) * 100,
): EditorQuestion => ({
  id: uid(),
  order,
  price,
  type: "simple",
  text: "",
  answer: "",
  choices: [],
  media: [],
});
const theme = (order: number, name = `Theme ${order + 1}`): EditorTheme => ({
  id: uid(),
  order,
  name,
  description: "",
  questions: Array.from({ length: 5 }, (_, index) => question(index)),
});
const round = (order: number, name = `Round ${order + 1}`): EditorRound => ({
  id: uid(),
  order,
  name,
  description: "",
  type: "standard",
  themes: Array.from({ length: 5 }, (_, index) => theme(index)),
});
export const createDocument = (): EditorPackage => ({
  title: "",
  description: "",
  language: "en",
  ageRestriction: "NONE",
  status: "draft",
  rounds: [round(0)],
});

export function validateDocument(document: EditorPackage): HealthIssue[] {
  const issues: HealthIssue[] = [];
  if (!document.title.trim())
    issues.push({
      id: "package-title",
      severity: "critical",
      messageKey: "editor.titleRequired",
    });
  if (document.rounds.length === 0)
    issues.push({
      id: "rounds",
      severity: "critical",
      messageKey: "editor.roundRequired",
    });
  for (const r of document.rounds) {
    if (!r.name.trim())
      issues.push({
        id: `${r.id}-name`,
        severity: "critical",
        messageKey: "editor.roundNameRequired",
        selection: { roundId: r.id },
      });
    for (const t of r.themes) {
      if (!t.name.trim())
        issues.push({
          id: `${t.id}-name`,
          severity: "critical",
          messageKey: "editor.themeNameRequired",
          selection: { roundId: r.id, themeId: t.id },
        });
      if (r.type === "final" && t.questions.length !== 1)
        issues.push({
          id: `${t.id}-final-count`,
          severity: "critical",
          messageKey: "editor.finalQuestionCount",
          selection: { roundId: r.id, themeId: t.id },
        });
      for (const q of t.questions) {
        const selection = { roundId: r.id, themeId: t.id, questionId: q.id };
        if (!q.text.trim())
          issues.push({
            id: `${q.id}-text`,
            severity: "critical",
            messageKey: "editor.questionRequired",
            selection,
          });
        if (!q.answer.trim())
          issues.push({
            id: `${q.id}-answer`,
            severity: "critical",
            messageKey: "editor.answerRequired",
            selection,
          });
        if (q.media.some((m) => m.size > 100 * 1024 * 1024))
          issues.push({
            id: `${q.id}-media`,
            severity: "warning",
            messageKey: "editor.mediaLarge",
            selection,
          });
        if (q.type === "choice" && q.choices.filter(Boolean).length < 2)
          issues.push({
            id: `${q.id}-choices`,
            severity: "critical",
            messageKey: "editor.choiceAnswersRequired",
            selection,
          });
        if (r.type === "final" && q.type !== "simple")
          issues.push({
            id: `${q.id}-final-type`,
            severity: "critical",
            messageKey: "editor.finalSimpleOnly",
            selection,
          });
        if (q.media.some((m) => m.type !== "image"))
          issues.push({
            id: `${q.id}-codec`,
            severity: "info",
            messageKey: "editor.codecWarning",
            selection,
          });
      }
    }
  }
  if (document.description.trim().length === 0)
    issues.push({
      id: "description",
      severity: "info",
      messageKey: "editor.descriptionSuggested",
    });
  return issues;
}

function snapshot(state: EditorState): Snapshot {
  return structuredClone({
    document: state.document,
    selection: state.selection,
    selectedIds: state.selectedIds,
  });
}
function revokeDocumentMedia(document: EditorPackage) {
  for (const media of document.rounds.flatMap((round) =>
    round.themes.flatMap((theme) =>
      theme.questions.flatMap((item) => item.media),
    ),
  ))
    if (media.url?.startsWith("blob:")) URL.revokeObjectURL(media.url);
}
function commit(
  set: (updater: (state: EditorState) => Partial<EditorState>) => void,
  mutation: (draft: EditorState) => void,
) {
  set((state) => {
    const previous = snapshot(state);
    const next = produce(state, mutation);
    return {
      ...next,
      undoStack: [...state.undoStack.slice(-49), previous],
      redoStack: [],
      dirty: true,
      issues: validateDocument(next.document),
    };
  });
}

const initialDocument = createDocument();
export const useEditorStore = create<EditorState>((set) => ({
  document: initialDocument,
  selection: { roundId: initialDocument.rounds[0]!.id },
  selectedIds: [],
  undoStack: [],
  redoStack: [],
  dirty: false,
  saving: false,
  progress: null,
  issues: validateDocument(initialDocument),
  replace: (document) =>
    set((state) => {
      revokeDocumentMedia(state.document);
      return {
        document,
        selection: { roundId: document.rounds[0]?.id ?? "" },
        selectedIds: [],
        undoStack: [],
        redoStack: [],
        dirty: false,
        issues: validateDocument(document),
      };
    }),
  select: (selection, additive = false) =>
    set((state) => {
      const currentId =
        state.selection.questionId ??
        state.selection.themeId ??
        state.selection.roundId;
      const nextId =
        selection.questionId ?? selection.themeId ?? selection.roundId;
      return {
        selection,
        selectedIds: additive
          ? Array.from(new Set([...state.selectedIds, currentId, nextId]))
          : [],
      };
    }),
  updatePackage: (patch) =>
    commit(set, (draft) => {
      Object.assign(draft.document, patch);
    }),
  updateRound: (id, patch) =>
    commit(set, (draft) => {
      const item = draft.document.rounds.find((r) => r.id === id);
      if (item) Object.assign(item, patch);
    }),
  updateTheme: (roundId, id, patch) =>
    commit(set, (draft) => {
      const item = draft.document.rounds
        .find((r) => r.id === roundId)
        ?.themes.find((t) => t.id === id);
      if (item) Object.assign(item, patch);
    }),
  updateQuestion: (roundId, themeId, id, patch) =>
    commit(set, (draft) => {
      const item = draft.document.rounds
        .find((r) => r.id === roundId)
        ?.themes.find((t) => t.id === themeId)
        ?.questions.find((q) => q.id === id);
      if (item) Object.assign(item, patch);
    }),
  addRound: () =>
    commit(set, (draft) => {
      const item = round(draft.document.rounds.length);
      draft.document.rounds.push(item);
      draft.selection = { roundId: item.id };
    }),
  addTheme: (roundId) =>
    commit(set, (draft) => {
      const r = draft.document.rounds.find((item) => item.id === roundId);
      if (r) {
        const item = theme(r.themes.length);
        r.themes.push(item);
        draft.selection = { roundId, themeId: item.id };
      }
    }),
  addQuestion: (roundId, themeId) =>
    commit(set, (draft) => {
      const t = draft.document.rounds
        .find((r) => r.id === roundId)
        ?.themes.find((item) => item.id === themeId);
      if (t) {
        const item = question(t.questions.length);
        t.questions.push(item);
        draft.selection = { roundId, themeId, questionId: item.id };
      }
    }),
  duplicateSelection: () =>
    commit(set, (draft) => {
      const { roundId, themeId, questionId } = draft.selection;
      const r = draft.document.rounds.find((item) => item.id === roundId);
      if (!r) return;
      const t = r.themes.find((item) => item.id === themeId);
      if (questionId && t) {
        const source = t.questions.find((item) => item.id === questionId);
        if (source) {
          const copy = {
            ...structuredClone(source),
            id: uid(),
            order: t.questions.length,
          };
          t.questions.push(copy);
          draft.selection.questionId = copy.id;
        }
      } else if (themeId) {
        const source = r.themes.find((item) => item.id === themeId);
        if (source) {
          const copy = {
            ...structuredClone(source),
            id: uid(),
            order: r.themes.length,
            questions: source.questions.map((q, order) => ({
              ...structuredClone(q),
              id: uid(),
              order,
            })),
          };
          r.themes.push(copy);
          draft.selection.themeId = copy.id;
        }
      }
    }),
  removeSelection: () =>
    commit(set, (draft) => {
      if (draft.selectedIds.length > 1) {
        const selected = new Set(draft.selectedIds);
        draft.document.rounds = draft.document.rounds
          .filter((item) => !selected.has(item.id))
          .map((item, roundOrder) => {
            item.order = roundOrder;
            item.themes = item.themes
              .filter((theme) => !selected.has(theme.id))
              .map((theme, themeOrder) => {
                theme.order = themeOrder;
                theme.questions = theme.questions
                  .filter((item) => !selected.has(item.id))
                  .map((item, questionOrder) => {
                    item.order = questionOrder;
                    return item;
                  });
                return theme;
              });
            return item;
          });
        draft.selectedIds = [];
        draft.selection = {
          roundId: draft.document.rounds[0]?.id ?? "",
        };
        return;
      }
      const { roundId, themeId, questionId } = draft.selection;
      const r = draft.document.rounds.find((item) => item.id === roundId);
      if (questionId && themeId && r) {
        const t = r.themes.find((item) => item.id === themeId);
        if (t)
          t.questions = t.questions
            .filter((q) => q.id !== questionId)
            .map((q, order) => ({ ...q, order }));
        draft.selection = { roundId, themeId };
      } else if (themeId && r) {
        r.themes = r.themes
          .filter((t) => t.id !== themeId)
          .map((t, order) => ({ ...t, order }));
        draft.selection = { roundId };
      } else {
        draft.document.rounds = draft.document.rounds
          .filter((item) => item.id !== roundId)
          .map((item, order) => ({ ...item, order }));
        draft.selection = { roundId: draft.document.rounds[0]?.id ?? "" };
      }
    }),
  moveTheme: (themeId, targetRoundId) =>
    commit(set, (draft) => {
      let moved: EditorTheme | undefined;
      for (const r of draft.document.rounds) {
        const index = r.themes.findIndex((t) => t.id === themeId);
        if (index >= 0) {
          moved = r.themes.splice(index, 1)[0];
          r.themes.forEach((t, order) => {
            t.order = order;
          });
          break;
        }
      }
      const target = draft.document.rounds.find((r) => r.id === targetRoundId);
      if (moved && target) {
        moved.order = target.themes.length;
        target.themes.push(moved);
        draft.selection = { roundId: targetRoundId, themeId: moved.id };
      }
    }),
  moveQuestion: (questionId, targetRoundId, targetThemeId, beforeQuestionId) =>
    commit(set, (draft) => {
      if (questionId === beforeQuestionId) return;
      let moved: EditorQuestion | undefined;
      for (const sourceRound of draft.document.rounds) {
        for (const sourceTheme of sourceRound.themes) {
          const index = sourceTheme.questions.findIndex(
            (item) => item.id === questionId,
          );
          if (index >= 0) {
            moved = sourceTheme.questions.splice(index, 1)[0];
            sourceTheme.questions.forEach((item, order) => {
              item.order = order;
            });
            break;
          }
        }
        if (moved) break;
      }
      const targetRound = draft.document.rounds.find(
        (item) => item.id === targetRoundId,
      );
      if (!moved || !targetRound) return;
      let targetTheme = targetRound.themes.find(
        (item) => item.id === targetThemeId,
      );
      if (!targetTheme) {
        targetTheme = targetRound.themes[0];
        if (!targetTheme) {
          targetTheme = theme(0);
          targetRound.themes.push(targetTheme);
        }
      }
      const targetIndex = beforeQuestionId
        ? targetTheme.questions.findIndex(
            (item) => item.id === beforeQuestionId,
          )
        : -1;
      targetTheme.questions.splice(
        targetIndex >= 0 ? targetIndex : targetTheme.questions.length,
        0,
        moved,
      );
      targetTheme.questions.forEach((item, order) => {
        item.order = order;
      });
      draft.selection = {
        roundId: targetRound.id,
        themeId: targetTheme.id,
        questionId: moved.id,
      };
    }),
  undo: () =>
    set((state) => {
      const previous = state.undoStack.at(-1);
      if (!previous) return {};
      return {
        ...previous,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, snapshot(state)],
        dirty: true,
        issues: validateDocument(previous.document),
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.redoStack.at(-1);
      if (!next) return {};
      return {
        ...next,
        undoStack: [...state.undoStack, snapshot(state)],
        redoStack: state.redoStack.slice(0, -1),
        dirty: true,
        issues: validateDocument(next.document),
      };
    }),
  markSaved: (status) =>
    set((state) => ({
      document: status ? { ...state.document, status } : state.document,
      dirty: false,
      saving: false,
      progress: null,
    })),
  setSaving: (saving, progress = null) => set({ saving, progress }),
}));

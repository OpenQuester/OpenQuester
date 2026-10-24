import { create } from "zustand";

/**
 * Which question the report dialog is open for. It lives outside the answer
 * reveal: the reveal ends while someone is still typing, and the dialog must
 * stay open with it.
 */
export const useReportStore = create<{
  questionId: number | null;
  scope: string;
  sent: string[];
  open: (scope: string, questionId: number) => void;
  close: () => void;
  markSent: (scope: string, questionId: number) => void;
}>((set) => ({
  questionId: null,
  scope: "",
  sent: [],
  open: (scope, questionId) => set({ scope, questionId }),
  close: () => set({ questionId: null }),
  markSent: (scope, questionId) =>
    set((s) => ({
      sent: [...s.sent, `${scope}:${questionId}`],
      questionId: s.scope === scope && s.questionId === questionId ? null : s.questionId,
    })),
}));

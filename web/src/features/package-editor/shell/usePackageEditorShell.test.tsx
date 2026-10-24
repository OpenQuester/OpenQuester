import { act, fireEvent, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { emptyPackage, newQuestion, newRound, newTheme } from "../packageDraft";
import { createPackageEditorStore, PackageEditorContext } from "../packageEditorStore";
import { usePackageEditorShell } from "./usePackageEditorShell";

afterEach(() => vi.unstubAllGlobals());

it("uses live package actions, follows viewport changes and scopes history shortcuts to its lifetime", () => {
  const listeners = new Set<() => void>();
  const mediaQuery = {
    matches: true,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", () => mediaQuery);
  const question = newQuestion(100, { text: "Capital?", answerText: "Kyiv" });
  const round = { ...newRound("Cities"), themes: [newTheme("Capitals", [question])] };
  const pkg = { ...emptyPackage("Quiz"), rounds: [round] };
  const store = createPackageEditorStore({
    draftId: "shell-actions",
    pkg,
    media: new Map(),
    savedAt: null,
  });
  const { result, unmount } = renderHook(usePackageEditorShell, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <PackageEditorContext.Provider value={store}>{children}</PackageEditorContext.Provider>
    ),
  });

  act(() => result.current.actions.open(question.id));
  expect(store.getState().selectedId).toBe(question.id);
  expect(store.getState().editingId).toBeNull();
  act(() => {
    mediaQuery.matches = false;
    listeners.forEach((listener) => listener());
  });
  act(() => result.current.actions.open(question.id));
  expect(store.getState().editingId).toBe(question.id);
  act(() => store.getState().edit(null));

  // Consecutive actions before a render must read the latest package.
  const actions = result.current.actions;
  act(() => {
    actions.duplicate(question.id);
    actions.duplicate(question.id);
  });
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions).toHaveLength(3);
  const copy = store.getState().selectedId!;
  act(() => result.current.actions.remove(copy));
  expect(store.getState().selectedId).toBeNull();

  const beforeDelete = store.getState().pkg;
  act(() => result.current.actions.removeRound(round.id));
  expect(store.getState().pkg).toBe(beforeDelete);
  expect(result.current.dialogs.confirm?.questions).toBe(2);
  act(() => result.current.dialogs.confirmRemoval());
  expect(store.getState().pkg.rounds).toEqual([]);
  expect(store.getState().roundId).toBeNull();

  const input = document.createElement("input");
  document.body.append(input);
  fireEvent.keyDown(input, { key: "z", ctrlKey: true });
  expect(store.getState().pkg.rounds).toEqual([]);
  input.remove();
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  document.body.append(dialog);
  fireEvent.keyDown(dialog, { key: "z", ctrlKey: true });
  expect(store.getState().pkg.rounds).toEqual([]);
  dialog.remove();

  fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
  expect(store.getState().pkg).toBe(beforeDelete);
  expect(store.getState().roundId).toBe(round.id);
  fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, shiftKey: true });
  expect(store.getState().pkg.rounds).toEqual([]);
  unmount();
  expect(listeners.size).toBe(0);
  fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
  expect(store.getState().pkg.rounds).toEqual([]);
});

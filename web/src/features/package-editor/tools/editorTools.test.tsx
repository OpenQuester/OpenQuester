import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { emptyPackage, newQuestion, newRound, newTheme } from "../packageDraft";
import { createPackageEditorStore, PackageEditorContext } from "../packageEditorStore";
import { PasteQuestionsDialog } from "./PasteQuestionsDialog";
import { RoundPricesDialog } from "./RoundPricesDialog";
import { useMoveTarget } from "./useMoveTarget";

function fixture() {
  const first = newQuestion(100, { text: "First", answerText: "One" });
  const second = newQuestion(300, { text: "Second", answerText: "Two" });
  const theme = newTheme("Source", [first, second]);
  const destination = newTheme("Destination", []);
  const round = { ...newRound("Round"), themes: [theme, destination] };
  const pkg = { ...emptyPackage("Tools"), rounds: [round] };
  const store = createPackageEditorStore({
    draftId: "tools",
    pkg,
    media: new Map(),
    savedAt: null,
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PackageEditorContext.Provider value={store}>{children}</PackageEditorContext.Provider>
  );
  return { first, second, theme, destination, round, pkg, store, wrapper };
}

it("keeps raw prices between openings, rejects invalid input and commits prices in one undo step", () => {
  const { round, store, pkg, wrapper } = fixture();
  const onClose = vi.fn();
  const view = render(<RoundPricesDialog roundId={round.id} onClose={onClose} />, { wrapper });
  fireEvent.change(screen.getByLabelText("First price"), { target: { value: "250" } });
  fireEvent.change(screen.getByLabelText("Step", { exact: true }), { target: { value: "-" } });
  expect(screen.getByRole("button", { name: "Set prices" })).toBeDisabled();
  view.rerender(<RoundPricesDialog roundId={null} onClose={onClose} />);
  view.rerender(<RoundPricesDialog roundId={round.id} onClose={onClose} />);
  expect(screen.getByLabelText("Step", { exact: true })).toHaveValue("-");
  fireEvent.change(screen.getByLabelText("Step", { exact: true }), { target: { value: "150" } });
  fireEvent.click(screen.getByRole("button", { name: "Set prices" }));
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions.map((q) => q.price)).toEqual([
    250, 400,
  ]);
  expect(store.getState().past).toHaveLength(1);
  expect(onClose).toHaveBeenCalledTimes(1);
  act(() => store.getState().undo());
  expect(store.getState().pkg).toBe(pkg);
});

it("retains a cancelled text import and clears it only after accepting the parsed themes", () => {
  const { round, store, wrapper } = fixture();
  const onClose = vi.fn();
  const view = render(<PasteQuestionsDialog roundId={round.id} onClose={onClose} />, { wrapper });
  const text = "Birds\n100. Fastest? | Falcon\n200. Largest?";
  fireEvent.change(screen.getByTestId("paste-text"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(store.getState().past).toHaveLength(0);
  view.rerender(<PasteQuestionsDialog roundId={null} onClose={onClose} />);
  view.rerender(<PasteQuestionsDialog roundId={round.id} onClose={onClose} />);
  expect(screen.getByTestId("paste-text")).toHaveValue(text);
  expect(screen.getByTestId("paste-summary")).toHaveTextContent("1 themes, 2 questions");
  fireEvent.click(screen.getByRole("button", { name: "Add to the round" }));
  expect(
    store
      .getState()
      .pkg.rounds[0]!.themes.at(-1)
      ?.questions.map((q) => q.answerText),
  ).toEqual(["Falcon", ""]);
  expect(store.getState().past).toHaveLength(1);
  expect(screen.getByTestId("paste-text")).toHaveValue("");
});

it("keeps price slots when reordering a theme and carries the question price across themes", () => {
  const { first, second, theme, destination, round, pkg, store, wrapper } = fixture();
  const onClose = vi.fn();
  const { result } = renderHook(() => useMoveTarget({ kind: "question", id: second.id }, onClose), {
    wrapper,
  });
  act(() => result.current.setPosition(0));
  act(() => result.current.move());
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions.map((q) => [q.id, q.price])).toEqual([
    [second.id, 100],
    [first.id, 300],
  ]);
  act(() => store.getState().undo());
  expect(store.getState().pkg).toBe(pkg);
  act(() => {
    result.current.setThemeId(destination.id);
    result.current.setPosition(-1);
  });
  act(() => result.current.move());
  expect(
    store.getState().pkg.rounds[0]!.themes.find((t) => t.id === theme.id)!.questions,
  ).toHaveLength(1);
  expect(
    store.getState().pkg.rounds[0]!.themes.find((t) => t.id === destination.id)!.questions[0],
  ).toEqual(second);
  expect(store.getState().selectedId).toBe(second.id);
  expect(store.getState().roundId).toBe(round.id);
  expect(onClose).toHaveBeenCalledTimes(2);
});

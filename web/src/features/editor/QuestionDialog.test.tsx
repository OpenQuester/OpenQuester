import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { md5Hex } from "@/features/upload/archive";

import {
  emptyPackage,
  newQuestion,
  newRound,
  newTheme,
  toUpload,
  type EditorQuestion,
} from "./model";
import { QuestionDialog } from "./QuestionDialog";
import { createEditorStore, EditorContext } from "./store";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(question: EditorQuestion, wide = false) {
  const listeners = new Set<() => void>();
  const mediaQuery = {
    matches: wide,
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", () => mediaQuery);
  const round = { ...newRound("Round"), themes: [newTheme("Theme", [question])] };
  const store = createEditorStore({
    draftId: "form-test",
    pkg: { ...emptyPackage("Quiz"), rounds: [round] },
    media: new Map(),
    savedAt: null,
  });
  store.getState().edit(question.id);
  render(
    <EditorContext.Provider value={store}>
      <QuestionDialog />
    </EditorContext.Provider>,
  );
  return {
    store,
    resize: (matches: boolean) =>
      act(() => {
        mediaQuery.matches = matches;
        for (const listener of [...listeners]) listener();
      }),
  };
}

it("saves decimal answers and tolerance while keeping prices and bids integral", async () => {
  const { store } = setup(newQuestion(100, { type: "stake", answerType: "number" }));
  const user = userEvent.setup();
  for (const [label, value] of [
    ["Right number", "3.14"],
    ["Allowed difference", "0.01"],
    ["Price", "100.4"],
    ["Highest bid", "500.4"],
  ]) {
    const input = screen.getByLabelText(label!);
    await user.clear(input);
    await user.type(input, value!);
  }
  await user.click(screen.getByTestId("question-save"));
  const saved = store.getState().pkg.rounds[0]!.themes[0]!.questions[0]!;
  expect(saved).toMatchObject({
    answerNumber: 3.14,
    answerDeviation: 0.01,
    price: 100,
    maxPrice: 500,
  });
  expect(toUpload(store.getState().pkg).rounds[0]!.themes[0]!.questions[0]).toMatchObject({
    answerNumber: 3.14,
    answerDeviation: 0.01,
    price: 100,
    maxPrice: 500,
  });
});

it.each([false, true])(
  "keeps one settings panel and the selected radio across resize (wide=%s)",
  async (wide) => {
    const { store, resize } = setup(
      newQuestion(100, { type: "secret", transferType: "any" }),
      wide,
    );
    const user = userEvent.setup();
    const assertUniqueSettings = () => {
      expect(screen.getAllByRole("radio", { hidden: true })).toHaveLength(2);
      const ids = [...screen.getByTestId("question-dialog").querySelectorAll("[id]")].map(
        (element) => element.id,
      );
      expect(new Set(ids).size).toBe(ids.length);
      expect(screen.getByLabelText("Prices the receiver picks from")).toBeVisible();
    };
    assertUniqueSettings();
    expect(screen.getByRole("radio", { name: "Any player" })).toBeChecked();
    await user.click(screen.getByText("Anyone but the picker"));
    expect(screen.getByRole("radio", { name: "Anyone but the picker" })).toBeChecked();
    resize(!wide);
    assertUniqueSettings();
    expect(screen.getByRole("radio", { name: "Anyone but the picker" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Any player" })).not.toBeChecked();
    await user.click(screen.getByTestId("question-save"));
    expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]!.transferType).toBe(
      "exceptCurrent",
    );
  },
);

it.each([
  ["questionFiles", "Shown with the question"],
  ["answerFiles", "Shown with the answer"],
] as const)("keeps removals and overlapping reads in %s", async (field, label) => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-media");
  const original = { md5: "a".repeat(32), type: "image" as const, displayTime: 5000 };
  const { store } = setup(newQuestion(100, { [field]: [original] }));
  const list = screen.getByText(label).parentElement!.parentElement!;
  const dropArea = list.children[1]!;
  const firstBytes = new Uint8Array([1, 2, 3]);
  const secondBytes = new Uint8Array([4, 5, 6]);
  let finishFirst!: (bytes: ArrayBuffer) => void;
  const slow = new File([], "slow.png", { type: "image/png" });
  Object.defineProperty(slow, "arrayBuffer", {
    value: () =>
      new Promise<ArrayBuffer>((resolve) => {
        finishFirst = resolve;
      }),
  });
  const fast = new File([], "fast.png", { type: "image/png" });
  Object.defineProperty(fast, "arrayBuffer", { value: async () => secondBytes.buffer });

  fireEvent.drop(dropArea, { dataTransfer: { files: [slow], types: ["Files"] } });
  await userEvent.setup().click(within(list).getByRole("button", { name: "Remove file" }));
  await act(async () =>
    fireEvent.drop(dropArea, { dataTransfer: { files: [fast], types: ["Files"] } }),
  );
  await act(async () => finishFirst(firstBytes.buffer));
  await userEvent.setup().click(screen.getByTestId("question-save"));

  const saved = store.getState().pkg.rounds[0]!.themes[0]!.questions[0]!;
  expect(saved[field].map((file) => file.md5)).toEqual([md5Hex(secondBytes), md5Hex(firstBytes)]);
  expect(store.getState().media.has(md5Hex(firstBytes))).toBe(true);
  expect(store.getState().media.has(md5Hex(secondBytes))).toBe(true);
});

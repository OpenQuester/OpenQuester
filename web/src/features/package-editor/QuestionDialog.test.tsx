import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { md5Hex } from "@/features/upload/archive";

import {
  emptyPackage,
  newQuestion,
  newRound,
  newTheme,
  toUpload,
  type DraftQuestion,
} from "./packageDraft";
import { QuestionDialog } from "./QuestionDialog";
import { AttachmentPreview } from "./AttachmentPreview";
import { createPackageEditorStore, PackageEditorContext } from "./packageEditorStore";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps a fractional media duration while typing and clears the point target when its image is removed", async () => {
  const q = newQuestion(100, {
    text: "Find it",
    answerType: "point",
    answerPoint: { x: 0.25, y: 0.5 },
    questionFiles: [
      { md5: "first", type: "image", displayTime: 5000 },
      { md5: "second", type: "image", displayTime: 5000 },
    ],
  });
  const { store } = setup(q);
  const user = userEvent.setup();
  const duration = screen.getAllByLabelText(/^Show/)[1]!;
  await user.clear(duration);
  await user.type(duration, "1.5");
  expect(duration).toHaveValue("1.5");
  await user.click(screen.getAllByRole("button", { name: "Remove file" })[0]!);
  await user.click(screen.getByTestId("question-save"));
  const saved = store.getState().pkg.rounds[0]!.themes[0]!.questions[0]!;
  expect(saved.questionFiles).toEqual([{ md5: "second", type: "image", displayTime: 1500 }]);
  expect(saved.answerPoint).toBeNull();
});

it("keeps incomplete reveal input and permits only durations from 2 to 30 seconds", async () => {
  const { store } = setup(newQuestion(100));
  const input = screen.getByLabelText("Answer reveal duration");
  const save = screen.getByTestId("question-save");
  fireEvent.change(input, { target: { value: "" } });
  expect(input).toHaveValue("");
  expect(save).toBeDisabled();
  fireEvent.change(input, { target: { value: "1.9" } });
  expect(save).toBeDisabled();
  fireEvent.change(input, { target: { value: "2" } });
  expect(save).toBeEnabled();
  fireEvent.change(input, { target: { value: "30" } });
  expect(save).toBeEnabled();
  fireEvent.change(input, { target: { value: "30.1" } });
  expect(save).toBeDisabled();
  fireEvent.change(input, { target: { value: "2.5" } });
  await userEvent.click(save);
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]!.showAnswerDuration).toBe(2500);
});

it("connects the selected answer mode to its explanation", async () => {
  setup(newQuestion(100));
  const select = screen.getByRole("combobox", { name: "How players answer" });
  expect(select).toHaveAccessibleDescription("The showman judges the answer.");
  await userEvent.selectOptions(select, "number");
  expect(select).toHaveAccessibleDescription(
    "The answer is checked automatically against the number.",
  );
});

it("maps the point slider to the larger image dimension without rewriting a legacy radius", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:point-image");
  const q = newQuestion(100, {
    answerType: "point",
    answerPoint: { x: 0.5, y: 0.5 },
    answerDeviation: 1.3,
    questionFiles: [{ md5: "point-image", type: "image", displayTime: 5000 }],
  });
  const { store } = setup(q);
  act(() =>
    store
      .getState()
      .addMedia([
        { md5: "point-image", type: "image", name: "point.png", bytes: new Uint8Array([1]) },
      ]),
  );
  const image = screen.getByTestId("point-picker").querySelector("img")!;
  Object.defineProperties(image, { naturalWidth: { value: 600 }, naturalHeight: { value: 1200 } });
  fireEvent.load(image);
  const slider = screen.getByRole("slider", { name: "Answer radius" });
  expect(slider).toHaveValue("100");
  expect(screen.getByText(/780 px radius/)).toBeInTheDocument();
  expect(screen.getByText(/exceeds the slider range/)).toBeInTheDocument();
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]!.answerDeviation).toBe(1.3);
  fireEvent.change(slider, { target: { value: "99" } });
  fireEvent.change(slider, { target: { value: "100" } });
  await userEvent.click(screen.getByTestId("question-save"));
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]!.answerDeviation).toBeCloseTo(1.2);
});

it("keeps the unsaved question mounted when the preview closes and does not save through it", async () => {
  const q = newQuestion(100, { text: "Original" });
  const { store } = setup(q);
  const text = screen.getByLabelText("Question text");
  fireEvent.change(text, { target: { value: "Unsaved" } });
  const opener = screen.getByRole("button", { name: "Preview" });
  await userEvent.click(opener);
  const preview = await screen.findByRole("dialog", { name: "Interactive game preview" });
  await screen.findByTestId("question-playtest");
  await userEvent.click(within(preview).getByRole("button", { name: /^Continue$/ }));
  await userEvent.click(within(preview).getByRole("button", { name: /^Continue$/ }));
  expect(preview).toHaveTextContent("Unsaved");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]!.text).toBe("Original");
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog", { name: "Interactive game preview" })).toBeNull();
  expect(screen.getByLabelText("Question text")).toBe(text);
  expect(text).toHaveValue("Unsaved");
  expect(opener).toHaveFocus();
});

it("returns focus to the invalid number target when the preview cannot run", async () => {
  const q = newQuestion(100, { text: "Question", answerType: "number", answerNumber: null });
  setup(q);
  await userEvent.click(screen.getByRole("button", { name: "Preview" }));
  const preview = await screen.findByRole("dialog", { name: "Interactive game preview" });
  expect(await within(preview).findByRole("alert")).toHaveTextContent(/number/i);
  await userEvent.click(within(preview).getByRole("button", { name: "Return to this field" }));
  await waitFor(() => expect(screen.getByLabelText("Right number")).toHaveFocus());
});

it("does not rewrite an imported reveal duration merely by opening the question", () => {
  const { store } = setup(newQuestion(100, { showAnswerDuration: 1234 }));
  expect(screen.getByLabelText("Answer reveal duration")).toHaveValue("1.234");
  expect(screen.getByTestId("question-save")).toBeDisabled();
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]!.showAnswerDuration).toBe(1234);
});

it("keeps a legacy reveal duration while answer media controls the timeline, then validates it on removal", async () => {
  const q = newQuestion(100, {
    showAnswerDuration: 60_000,
    answerFiles: [{ md5: "missing", type: "image", displayTime: 5000 }],
  });
  const { store } = setup(q);
  const duration = screen.getByLabelText("Answer reveal duration");
  expect(duration).toBeDisabled();
  expect(screen.getByTestId("question-save")).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Question text"), { target: { value: "Edited" } });
  await userEvent.click(screen.getByTestId("question-save"));
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]!.showAnswerDuration).toBe(60_000);
  act(() => store.getState().edit(q.id));
  await userEvent.click(screen.getByRole("button", { name: "Remove file" }));
  expect(screen.getByLabelText("Answer reveal duration")).toBeEnabled();
  expect(screen.getByTestId("question-save")).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("2 to 30 seconds");
});

it("reads duration from the visible media and clears it when the attachment changes", () => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(URL, "createObjectURL")
    .mockReturnValueOnce("blob:first")
    .mockReturnValueOnce("blob:second");
  const first = {
    md5: "first",
    type: "audio" as const,
    name: "first.mp3",
    bytes: new Uint8Array([1]),
  };
  const second = { ...first, md5: "second", name: "second.mp3" };
  const store = createPackageEditorStore({
    draftId: "duration",
    pkg: emptyPackage("Audio"),
    savedAt: null,
    media: new Map([
      [first.md5, first],
      [second.md5, second],
    ]),
  });
  const preview = (media: typeof first) => (
    <PackageEditorContext.Provider value={store}>
      <AttachmentPreview media={media} />
    </PackageEditorContext.Provider>
  );
  const view = render(preview(first));
  const audio = view.container.querySelector("audio")!;
  Object.defineProperty(audio, "duration", { value: 17, configurable: true });
  fireEvent.durationChange(audio);
  expect(view.container.textContent).toContain("17");
  view.rerender(preview(second));
  expect(view.container.textContent).not.toContain("17");
  const replacement = view.container.querySelector("audio")!;
  Object.defineProperty(replacement, "duration", { value: 23, configurable: true });
  fireEvent.durationChange(replacement);
  expect(view.container.textContent).toContain("23");
});

it("keeps a remote size unknown until HEAD completes and ignores a stale source", async () => {
  let resolveFirst: (response: Response) => void = () => {};
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url.endsWith("first")
        ? new Promise<Response>((resolve) => {
            resolveFirst = resolve;
          })
        : Promise.resolve(new Response(null, { headers: { "Content-Length": "2048" } })),
    ),
  );
  const first = {
    md5: "first",
    type: "audio" as const,
    name: "first.mp3",
    bytes: new Uint8Array(),
    url: "https://media.test/first",
  };
  const second = { ...first, md5: "second", url: "https://media.test/second" };
  const store = createPackageEditorStore({
    draftId: "size",
    pkg: emptyPackage("Audio"),
    savedAt: null,
    media: new Map([
      [first.md5, first],
      [second.md5, second],
    ]),
  });
  const preview = (media: typeof first) => (
    <PackageEditorContext.Provider value={store}>
      <AttachmentPreview media={media} />
    </PackageEditorContext.Provider>
  );
  const view = render(preview(first));
  expect(view.container.textContent).toContain("Size unknown");
  expect(view.container.textContent).not.toContain("0 B");
  view.rerender(preview(second));
  await waitFor(() => expect(view.container.textContent).toContain("2 KB"));
  await act(async () => resolveFirst(new Response(null, { headers: { "Content-Length": "17" } })));
  expect(view.container.textContent).toContain("2 KB");
  expect(view.container.textContent).not.toContain("17 B");
});

it("edits all accepted answers in one field and preserves them through save and reopen", async () => {
  const q = newQuestion(100, { answerText: "Kyiv", rightAnswers: ["Kiev", "Київ"] });
  const { store } = setup(q);
  expect(screen.getByLabelText("Correct answers")).toHaveValue("Kyiv\nKiev\nКиїв");
  expect(screen.queryByLabelText(/Also accept/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Correct answers"), {
    target: { value: "Paris\n\n Paris, France \nПариж" },
  });
  await userEvent.click(screen.getByTestId("question-save"));
  expect(toUpload(store.getState().pkg).rounds[0]!.themes[0]!.questions[0]).toMatchObject({
    answerText: "Paris",
    rightAnswers: ["Paris, France", "Париж"],
  });
  act(() => store.getState().edit(q.id));
  expect(screen.getByLabelText("Correct answers")).toHaveValue("Paris\nParis, France\nПариж");
  fireEvent.change(screen.getByLabelText("Correct answers"), { target: { value: "" } });
  await userEvent.click(screen.getByTestId("question-save"));
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]).toMatchObject({
    answerText: "",
    rightAnswers: [],
  });
});

it("keeps alternative accepted answers when switching to choice and back", async () => {
  const { store } = setup(newQuestion(100, { answerText: "Kyiv", rightAnswers: ["Kiev"] }));
  await userEvent.click(screen.getByRole("button", { name: /^Choice/ }));
  expect(screen.getByLabelText(/Also accept/)).toHaveValue("Kiev");
  await userEvent.click(screen.getByRole("button", { name: /^Simple/ }));
  expect(screen.getByLabelText("Correct answers")).toHaveValue("Kyiv\nKiev");
  await userEvent.click(screen.getByTestId("question-save"));
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]).toMatchObject({
    answerText: "Kyiv",
    rightAnswers: ["Kiev"],
  });
});

it("keeps choice correctness and form history when renaming an option and changing type", async () => {
  const original = newQuestion(100, { answerText: "Kyiv", rightAnswers: ["Kiev"] });
  const { store } = setup(original);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^Choice/ }));
  const first = screen.getByLabelText("Option A");
  // Keep the original as a prefix while typing, so every edit follows the
  // currently correct option rather than accidentally selecting a blank one.
  await user.type(first, ", Ukraine");
  await user.type(screen.getByLabelText("Option B"), "Lviv");
  await user.click(screen.getByRole("button", { name: /^Simple/ }));
  expect(screen.getByLabelText("Correct answers")).toHaveValue("Kyiv, Ukraine\nKiev");
  await user.click(screen.getByRole("button", { name: /^Choice/ }));
  expect(screen.getByLabelText("Option A")).toHaveValue("Kyiv, Ukraine");
  expect(screen.getByLabelText("Option B")).toHaveValue("Lviv");
  expect(screen.getAllByRole("radio", { name: "Correct" })[0]).toBeChecked();
  expect(store.getState().past).toHaveLength(0);
  await user.click(screen.getByTestId("question-save"));
  expect(store.getState().past).toHaveLength(1);
  act(() => store.getState().undo());
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]).toEqual(original);
  act(() => store.getState().redo());
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]).toMatchObject({
    type: "choice",
    answerText: "Kyiv, Ukraine",
    rightAnswers: ["Kiev"],
  });
});

function setup(question: DraftQuestion, wide = false) {
  const listeners = new Set<() => void>();
  const mediaQuery = {
    matches: wide,
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", () => mediaQuery);
  const round = { ...newRound("Round"), themes: [newTheme("Theme", [question])] };
  const store = createPackageEditorStore({
    draftId: "form-test",
    pkg: { ...emptyPackage("Quiz"), rounds: [round] },
    media: new Map(),
    savedAt: null,
  });
  store.getState().edit(question.id);
  render(
    <PackageEditorContext.Provider value={store}>
      <QuestionDialog />
    </PackageEditorContext.Provider>,
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
  const { store } = setup(
    newQuestion(100, { type: "stake", answerType: "number", answerDelay: 7250 }),
  );
  expect(screen.queryByLabelText(/Answer window/i)).not.toBeInTheDocument();
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
    answerDelay: 7250,
  });
  expect(toUpload(store.getState().pkg).rounds[0]!.themes[0]!.questions[0]).toMatchObject({
    answerNumber: 3.14,
    answerDeviation: 0.01,
    price: 100,
    maxPrice: 500,
    answerDelay: 7250,
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
    const prices = screen.getByLabelText("Prices the receiver picks from");
    await user.type(prices, "100, 200, ");
    resize(!wide);
    assertUniqueSettings();
    expect(screen.getByLabelText("Prices the receiver picks from")).toBe(prices);
    expect(prices).toHaveValue("100, 200, ");
    expect(prices).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Anyone but the picker" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Any player" })).not.toBeChecked();
    await user.click(screen.getByTestId("question-save"));
    expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]!.transferType).toBe(
      "exceptCurrent",
    );
  },
);

it("preserves incomplete numeric input across responsive breakpoints", async () => {
  const { resize } = setup(newQuestion(100, { answerType: "number" }), true);
  const number = screen.getByLabelText("Right number");
  await userEvent.type(number, "1.");
  resize(false);
  expect(screen.getByLabelText("Right number")).toBe(number);
  expect(number).toHaveValue("1.");
  expect(number).toHaveFocus();
});

it.each([
  ["questionFiles", "Shown with the question"],
  ["answerFiles", "Shown with the answer"],
] as const)("stages sequential imports in %s until the question is saved", async (field, label) => {
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

  await userEvent.setup().click(within(list).getByRole("button", { name: "Remove file" }));
  fireEvent.drop(dropArea, { dataTransfer: { files: [slow, fast], types: ["Files"] } });
  expect(store.getState().media.size).toBe(0);
  await act(async () => finishFirst(firstBytes.buffer));
  await waitFor(() => expect(screen.getByRole("button", { name: "Use unchanged" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "Use unchanged" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Use unchanged" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "Use unchanged" }));
  expect(store.getState().media.size).toBe(0);
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]![field]).toEqual([original]);
  await userEvent.setup().click(screen.getByTestId("question-save"));

  const saved = store.getState().pkg.rounds[0]!.themes[0]!.questions[0]!;
  expect(saved[field].map((file) => file.md5)).toEqual([md5Hex(firstBytes), md5Hex(secondBytes)]);
  expect(store.getState().media.has(md5Hex(firstBytes))).toBe(true);
  expect(store.getState().media.has(md5Hex(secondBytes))).toBe(true);
});

it("discarding the question drops accepted staged media without writing the store", async () => {
  const { store } = setup(newQuestion(100));
  const source = new File([], "original.gif", { type: "image/gif" });
  Object.defineProperty(source, "arrayBuffer", {
    value: async () => new TextEncoder().encode("GIF89a").buffer,
  });
  const input = screen.getByText("Shown with the question").parentElement!.querySelector("input")!;
  fireEvent.change(input, { target: { files: [source] } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Use unchanged" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "Use unchanged" }));
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await userEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(store.getState().media.size).toBe(0);
  expect(store.getState().pkg.rounds[0]!.themes[0]!.questions[0]!.questionFiles).toEqual([]);
});

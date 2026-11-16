import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { newQuestion } from "../packageDraft";
import { QuestionPlaytest } from "./QuestionPlaytest";
import { i18n } from "@/i18n";

afterEach(async () => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  await i18n.changeLanguage("en");
});

async function waitForPreview() {
  await screen.findByTestId("question-playtest");
  await screen.findByTestId("question-pick-transition");
  await waitFor(() => expect(screen.queryByTestId("question-pick-transition")).toBeNull(), {
    timeout: 2000,
  });
}

it("explains an unreadable final media duration and allows retry", async () => {
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    if (this.getAttribute("src")) queueMicrotask(() => this.dispatchEvent(new Event("error")));
  });
  const q = newQuestion(null, {
    text: "Question",
    answerText: "Answer",
    questionFiles: [{ md5: "clip", type: "video", displayTime: null }],
  });
  render(
    <QuestionPlaytest
      question={q}
      final
      themeName="Final"
      canSave
      onFix={() => {}}
      media={
        new Map([
          [
            "clip",
            {
              md5: "clip",
              type: "video",
              name: "clip.webm",
              bytes: new Uint8Array(),
              url: "https://example.test/clip",
            },
          ],
        ])
      }
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not read the duration of clip.webm",
  );
  expect(screen.getByRole("button", { name: /try again/i })).toBeEnabled();
});

it("keeps a running preview's image alive across language changes and releases it on close", async () => {
  vi.spyOn(window, "Image").mockImplementation(function () {
    const image = document.createElement("img");
    image.decode = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(image, "src", {
      set: () => queueMicrotask(() => image.onload?.call(image, new Event("load"))),
    });
    return image;
  });
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:choice-image");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const q = newQuestion(100, {
    type: "choice",
    text: "Question",
    correctChoiceOptionId: "image",
    options: [
      { id: "image", text: "", file: { md5: "image", type: "image" } },
      { id: "other", text: "Other", file: null },
    ],
  });
  const media = new Map([
    [
      "image",
      { md5: "image", type: "image" as const, name: "image.png", bytes: new Uint8Array([1]) },
    ],
  ]);
  const view = render(
    <QuestionPlaytest
      question={q}
      final={false}
      themeName="Theme"
      media={media}
      canSave
      onFix={() => {}}
    />,
  );
  await waitForPreview();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(await screen.findByTestId("buzz"));
  const option = screen.getByRole("button", { name: "Option 1" });
  expect(option.closest("li")!.querySelector("img")).toHaveAttribute("src", "blob:choice-image");
  await act(async () => {
    await i18n.changeLanguage("uk");
  });
  expect(create).toHaveBeenCalledTimes(1);
  expect(revoke).not.toHaveBeenCalled();
  const localizedOption = screen.getByRole("button", { name: "Варіант 1" });
  expect(localizedOption).toBeEnabled();
  fireEvent.click(localizedOption);
  expect(screen.getByTestId("answer-reveal").querySelector("img")).toHaveAttribute(
    "src",
    "blob:choice-image",
  );
  fireEvent.click(screen.getByRole("button", { name: "Почати знову" }));
  expect(revoke).not.toHaveBeenCalled();
  view.unmount();
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:choice-image");
});

it("runs and pauses the question and reveal clocks and clears them on close", async () => {
  const q = newQuestion(100, {
    text: "Timed question",
    answerText: "Answer",
    showAnswerDuration: 2000,
  });
  const view = render(
    <QuestionPlaytest
      question={q}
      final={false}
      themeName="Theme"
      media={new Map()}
      canSave
      onFix={() => {}}
    />,
  );
  await waitForPreview();
  await waitFor(() => expect(screen.getByTestId("dock-phase")).toHaveTextContent("Ready to buzz"));
  vi.useFakeTimers({
    toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
  expect(screen.getByTestId("dock-phase")).toHaveTextContent("Ready to buzz");
  fireEvent.click(screen.getByRole("button", { name: /^Pause$/ }));
  await act(async () => {
    vi.advanceTimersByTime(30_000);
  });
  expect(screen.getByTestId("dock-phase")).toHaveTextContent("Paused");
  fireEvent.click(screen.getByRole("button", { name: "Resume" }));
  await act(async () => {
    vi.advanceTimersByTime(23_000);
  });
  expect(screen.getByTestId("answer-reveal")).toHaveTextContent("Answer");
  await act(async () => {
    vi.advanceTimersByTime(2_000);
  });
  expect(screen.getByTestId("dock-phase")).toHaveTextContent("Game over");
  expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Restart" }));
  expect(screen.getByTestId("dock-phase")).toHaveTextContent("Loading question");
  await act(async () => {
    vi.advanceTimersByTime(1750);
  });
  expect(screen.getByTestId("dock-phase")).toHaveTextContent("Ready to buzz");
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("shows delayed choices only after advancing their real content clock", async () => {
  const q = newQuestion(100, {
    type: "choice",
    text: "Pick one",
    answerText: "Blue",
    showDelay: 3000,
    options: [
      { id: "a", text: "Blue", file: null },
      { id: "b", text: "Red", file: null },
    ],
  });
  render(
    <QuestionPlaytest
      question={q}
      final={false}
      themeName="Theme"
      media={new Map()}
      canSave
      onFix={() => {}}
    />,
  );
  await waitForPreview();
  expect(screen.queryByRole("button", { name: "Blue" })).toBeNull();
  const advance = screen.getByRole("button", { name: "Continue" });
  expect(advance).toBeEnabled();
  fireEvent.click(advance);
  expect(screen.queryByRole("button", { name: "Blue" })).toBeNull();
  expect(advance).toBeEnabled();
  fireEvent.click(advance);
  expect(screen.getByRole("button", { name: "Blue" })).toBeInTheDocument();
});

it("explains manual judging according to the selected perspective", async () => {
  const q = newQuestion(100, { text: "Question", answerText: "Answer" });
  render(
    <QuestionPlaytest
      question={q}
      final={false}
      themeName="Theme"
      media={new Map()}
      canSave
      onFix={() => {}}
    />,
  );
  await waitForPreview();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(await screen.findByTestId("buzz"));
  fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), {
    target: { value: "Answer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(
    screen.getByText("Switch to the showman to judge the submitted answers."),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("View as"), { target: { value: "1" } });
  expect(
    screen.getByText("Judge the submitted answers using the controls below."),
  ).toBeInTheDocument();
});

it.each([
  { price: 1000, realPrice: 100, blocked: false },
  { price: 100, realPrice: 1000, blocked: true },
])(
  "uses actual $realPrice for preview auction cap at nominal $price",
  async ({ price, realPrice, blocked }) => {
    const q = newQuestion(price, {
      type: "stake",
      text: "Question",
      answerText: "Answer",
      realPrice,
      maxPrice: 500,
    });
    render(
      <QuestionPlaytest
        question={q}
        final={false}
        themeName="Theme"
        media={new Map()}
        canSave
        onFix={() => {}}
      />,
    );
    if (blocked)
      expect(await screen.findByRole("alert")).toHaveTextContent(
        i18n.t("editor.playtest.stakeLimit"),
      );
    else expect(await screen.findByTestId("question-playtest")).toBeInTheDocument();
  },
);

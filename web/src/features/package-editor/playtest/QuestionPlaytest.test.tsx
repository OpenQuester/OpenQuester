import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

it("keeps a running preview's image alive across language changes and releases it on close", async () => {
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
  await screen.findByTestId("question-playtest");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(await screen.findByTestId("buzz"));
  const option = screen.getByRole("button", { name: "Option 1" });
  expect(option.querySelector("img")).toHaveAttribute("src", "blob:choice-image");
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
  await screen.findByTestId("question-playtest");
  vi.useFakeTimers({
    toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
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
  expect(screen.getByTestId("dock-phase")).toHaveTextContent("Choosing");
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
  await screen.findByTestId("question-playtest");
  vi.useFakeTimers({
    toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  });
  expect(screen.queryByRole("button", { name: "Blue" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
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
  await screen.findByTestId("question-playtest");
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

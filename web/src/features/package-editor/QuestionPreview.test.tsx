import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { emptyPackage, newQuestion, type DraftQuestion } from "./packageDraft";
import { createPackageEditorStore, PackageEditorContext } from "./packageEditorStore";
import { QuestionPreview } from "./QuestionPreview";

afterEach(() => vi.restoreAllMocks());

function setup(question: DraftQuestion, mediaIds = ["first", "second"]) {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:question-image");
  const store = createPackageEditorStore({
    draftId: "point-preview",
    pkg: emptyPackage("Preview"),
    savedAt: null,
    media: new Map(
      mediaIds.map((md5) => [
        md5,
        { md5, type: "image" as const, name: `${md5}.png`, bytes: new Uint8Array([1]) },
      ]),
    ),
  });
  const view = (q: DraftQuestion, final = false) => (
    <PackageEditorContext.Provider value={store}>
      <QuestionPreview question={q} final={final} />
    </PackageEditorContext.Provider>
  );
  return { ...render(view(question)), view };
}

const image = (md5: string) => ({ md5, type: "image" as const, displayTime: null });

it("shows the numeric target, including zero, instead of hidden stale answer text", () => {
  const question = newQuestion(100, {
    answerType: "number",
    answerNumber: 0,
    answerText: "Old answer",
  });
  const { rerender, view } = setup(question);
  expect(screen.getByText("0")).toBeInTheDocument();
  expect(screen.queryByText("Old answer")).not.toBeInTheDocument();
  rerender(view({ ...question, answerNumber: null }));
  expect(screen.getByText("Enter the right number")).toBeInTheDocument();
  expect(screen.queryByText("Old answer")).not.toBeInTheDocument();
  rerender(view({ ...question, type: "choice" }));
  expect(screen.getByText("Old answer")).toBeInTheDocument();
  rerender(view({ ...question, type: "choice" }, true));
  expect(screen.getByText("0")).toBeInTheDocument();
});

it("shows the first image target temporarily or pinned without replacing the image, then resets on identity changes", async () => {
  const question = newQuestion(100, {
    answerType: "point",
    answerText: "stale text",
    answerPoint: { x: 0.254, y: 0.754 },
    questionFiles: [
      { md5: "audio", type: "audio", displayTime: null },
      image("first"),
      image("second"),
    ],
  });
  const { rerender, view } = setup(question);
  const control = screen.getByRole("button", { name: "Point on image 1 · 25.4%, 75.4%" });
  const picker = screen.getByTestId("point-picker");
  const picture = picker.querySelector("img");
  expect(screen.queryByText("stale text")).not.toBeInTheDocument();
  expect(screen.queryByTestId("point-target")).not.toBeInTheDocument();
  fireEvent.mouseEnter(control);
  expect(screen.getByTestId("point-target")).toHaveStyle({
    left: "25.4%",
    top: "75.4%",
    width: "10%",
  });
  expect(picker.querySelector("img")).toBe(picture);
  fireEvent.mouseLeave(control);
  expect(screen.queryByTestId("point-target")).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(control);
  expect(control).toHaveAttribute("aria-pressed", "true");
  await user.click(control);
  expect(control).toHaveAttribute("aria-pressed", "false");
  expect(screen.queryByTestId("point-target")).not.toBeInTheDocument();
  await user.keyboard("{Enter}");
  expect(control).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByTestId("point-target")).toBeInTheDocument();
  await user.keyboard(" ");
  expect(screen.queryByTestId("point-target")).not.toBeInTheDocument();
  fireEvent.click(control);
  rerender(view({ ...question, questionFiles: [image("second")] }));
  expect(screen.getByRole("button", { name: /Point on image 1/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(screen.queryByTestId("point-target")).not.toBeInTheDocument();
  rerender(view(question));
  expect(screen.getByRole("button", { name: /Point on image 1/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  fireEvent.click(screen.getByRole("button", { name: /Point on image 1/ }));
  rerender(view({ ...question, id: "another-question" }));
  expect(screen.queryByTestId("point-target")).not.toBeInTheDocument();
});

it("handles missing or invalid targets and keeps a choice answer when point mode is stale", () => {
  const question = newQuestion(100, {
    answerType: "point",
    answerText: "Actual answer",
    answerPoint: { x: 0.5, y: 0.5 },
    questionFiles: [image("missing")],
  });
  const { rerender, view } = setup(question);
  expect(screen.getByText("The point or its image is unavailable.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Point on image/ })).not.toBeInTheDocument();
  rerender(view({ ...question, questionFiles: [image("first")], answerPoint: null }));
  expect(screen.getByText("The point or its image is unavailable.")).toBeInTheDocument();
  rerender(view({ ...question, questionFiles: [image("first")], answerPoint: { x: -1, y: 0.5 } }));
  expect(screen.getByText("The point or its image is unavailable.")).toBeInTheDocument();
  rerender(view({ ...question, type: "choice", questionFiles: [image("first")] }));
  expect(screen.getByText("Actual answer")).toBeInTheDocument();
  expect(screen.queryByTestId("point-picker")).not.toBeInTheDocument();
  rerender(view({ ...question, type: "choice", questionFiles: [image("first")] }, true));
  expect(screen.getByRole("button", { name: /Point on image 1/ })).toBeInTheDocument();
});

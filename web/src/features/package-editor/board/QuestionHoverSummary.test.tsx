import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { newQuestion } from "../packageDraft";
import { QuestionHoverSummary } from "./QuestionHoverSummary";

it("keeps the answer visible without media controls in the compact tooltip", () => {
  const question = newQuestion(100, {
    text: "Long question ".repeat(100),
    answerText: "The answer is amber",
    questionFiles: Array.from({ length: 10 }, (_, i) => ({
      md5: String(i),
      type: "video" as const,
      displayTime: null,
    })),
  });
  const view = render(<QuestionHoverSummary question={question} final={false} />);
  expect(screen.getByText("The answer is amber")).toBeVisible();
  expect(screen.getByText("Media files: 10")).toBeVisible();
  expect(screen.getByText("Select the question for the full preview.")).toBeVisible();
  expect(view.container.querySelector("button, input, video, audio, a")).toBeNull();
});

it("does not report a missing answer for a selected image-only choice", () => {
  const question = newQuestion(100, {
    type: "choice",
    correctChoiceOptionId: "image",
    options: [
      { id: "image", text: "", file: { md5: "picture", type: "image" } },
      { id: "other", text: "Other", file: null },
    ],
  });
  render(<QuestionHoverSummary question={question} final={false} />);
  expect(screen.getByText("Media answer")).toBeVisible();
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { buildContentPlan } from "@/game/contentPlan";
import type { QuestionFile } from "@/game/protocol";
import type { ContentClock } from "@/game/reducer";
import { ContentStage } from "./ContentStage";

afterEach(cleanup);

it("shows each text at its own timeline position and recaps only the main text", () => {
  const files: QuestionFile[] = [
    { order: 1, displayTime: null, file: { md5: "image", type: "image", link: "/image" } },
  ];
  const textItems = [{ order: 2, text: "Another clue" }];
  const plan = buildContentPlan({ text: "Main question", textOrder: 0, textItems, files })!;
  const clock: ContentClock = { kind: "question", plan, frozenAtMs: 0, timer: null };
  const renderAt = (time: number) => (
    <ContentStage
      content={{ ...clock, frozenAtMs: time }}
      files={files}
      text="Main question"
      textOrder={0}
      textItems={textItems}
      paused={false}
    />
  );
  const view = render(renderAt(0));
  expect(screen.getByTestId("question-text")).toHaveTextContent("Main question");
  view.rerender(renderAt(7_000));
  expect(screen.getByTestId("question-text")).toHaveTextContent("Another clue");
  view.rerender(renderAt(plan.totalMs));
  expect(screen.getByTestId("question-recap")).toHaveTextContent("Main question");
});

it("does not mistake a legacy caption for an additional text step", () => {
  const textItems = [{ order: 0, text: "Later text" }];
  const plan = buildContentPlan({ text: "Legacy caption", textOrder: null, textItems })!;
  render(
    <ContentStage
      content={{ kind: "question", plan, frozenAtMs: plan.totalMs, timer: null }}
      files={[]}
      text="Legacy caption"
      textOrder={null}
      textItems={textItems}
      paused={false}
    />,
  );
  expect(screen.getByTestId("question-text")).toHaveTextContent("Later text");
  expect(screen.queryByTestId("question-recap")).toBeNull();
});

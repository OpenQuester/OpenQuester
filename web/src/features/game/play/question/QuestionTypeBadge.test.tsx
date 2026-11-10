import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QuestionTypeBadge } from "./QuestionTypeBadge";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("waits 300ms for hover, cancels abandoned hovers and opens immediately on focus", () => {
  vi.useFakeTimers();
  const view = render(<QuestionTypeBadge type="noRisk" />);
  const button = screen.getByTestId("question-type-badge");
  expect(screen.queryByRole("button", { name: "No risk" })).toBeNull();
  const tooltip = screen.getByRole("tooltip", { hidden: true });
  const show = vi.fn();
  tooltip.showPopover = show;
  tooltip.hidePopover = vi.fn();
  fireEvent.click(button);
  expect(show).not.toHaveBeenCalled();
  const enter = () =>
    fireEvent(
      button,
      Object.assign(new Event("pointerover", { bubbles: true }), { pointerType: "mouse" }),
    );
  const leave = () =>
    fireEvent(
      button,
      new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body }),
    );

  enter();
  act(() => vi.advanceTimersByTime(299));
  expect(show).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(show).toHaveBeenCalledTimes(1);
  leave();
  enter();
  act(() => vi.advanceTimersByTime(200));
  leave();
  act(() => vi.advanceTimersByTime(500));
  expect(show).toHaveBeenCalledTimes(1);
  enter();
  fireEvent.focus(button);
  expect(show).toHaveBeenCalledTimes(2);
  act(() => vi.advanceTimersByTime(500));
  expect(show).toHaveBeenCalledTimes(2);
  enter();
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

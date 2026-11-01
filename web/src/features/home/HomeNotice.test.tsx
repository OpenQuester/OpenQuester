import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useSettings } from "@/features/settings/settingsStore";
import { HomeNotice, HOME_NOTICE_EXIT, HOME_NOTICE_LIFETIME } from "./HomeNotice";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  useSettings.setState({ reduceMotion: false });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  useSettings.setState({ reduceMotion: false });
});

it("waits 30 seconds, then closes over 300ms and clears timers on unmount", () => {
  const onDismiss = vi.fn();
  const view = render(<HomeNotice reason="deleted" onDismiss={onDismiss} />);
  act(() => vi.advanceTimersByTime(HOME_NOTICE_LIFETIME - 1));
  expect(screen.getByTestId("home-notice")).not.toHaveAttribute("data-closing");
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByTestId("home-notice")).toHaveAttribute("data-closing", "true");
  act(() => vi.advanceTimersByTime(HOME_NOTICE_EXIT - 1));
  expect(onDismiss).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onDismiss).toHaveBeenCalledOnce();
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it.each([false, true])(
  "closes by cross, respects reduced motion (%s), and cannot close a newer notice",
  (reduced) => {
    useSettings.setState({ reduceMotion: reduced });
    const oldDismiss = vi.fn(),
      newDismiss = vi.fn();
    const view = render(<HomeNotice key="deleted" reason="deleted" onDismiss={oldDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    act(() => vi.advanceTimersByTime(reduced ? 0 : 299));
    expect(oldDismiss).toHaveBeenCalledTimes(reduced ? 1 : 0);
    view.rerender(<HomeNotice key="kicked" reason="kicked" onDismiss={newDismiss} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(newDismiss).not.toHaveBeenCalled();
    expect(oldDismiss).toHaveBeenCalledTimes(reduced ? 1 : 0);
  },
);

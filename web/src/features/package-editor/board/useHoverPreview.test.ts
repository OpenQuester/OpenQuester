import { act, renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useQuestionHoverPreview } from "./useQuestionHoverPreview";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("delays mouse previews, keeps them inside the viewport and cancels pending work", () => {
  vi.useFakeTimers();
  vi.stubGlobal("innerWidth", 1000);
  vi.stubGlobal("innerHeight", 800);
  const { result, unmount } = renderHook(useQuestionHoverPreview);
  const anchor = document.createElement("div");
  anchor.getBoundingClientRect = () => ({ left: 900, right: 980, top: 700 }) as DOMRect;
  result.current.anchor.current = anchor;
  const pointer = (pointerType: string) => ({ pointerType }) as PointerEvent;

  act(() => result.current.onPointerEnter(pointer("touch")));
  act(() => vi.advanceTimersByTime(400));
  expect(result.current.pos).toBeNull();
  act(() => result.current.onPointerEnter(pointer("mouse")));
  act(() => vi.advanceTimersByTime(379));
  expect(result.current.pos).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.pos).toEqual({ top: 380, left: 548 });
  act(() => result.current.onPointerDown());
  expect(result.current.pos).toBeNull();

  act(() => result.current.onPointerEnter(pointer("mouse")));
  act(() => result.current.onPointerLeave());
  act(() => vi.advanceTimersByTime(400));
  expect(result.current.pos).toBeNull();
  anchor.getBoundingClientRect = () => ({ left: 20, right: 120, top: 0 }) as DOMRect;
  act(() => result.current.onPointerEnter(pointer("mouse")));
  act(() => vi.advanceTimersByTime(380));
  expect(result.current.pos).toEqual({ top: 8, left: 132 });
  act(() => result.current.onPointerEnter(pointer("mouse")));
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

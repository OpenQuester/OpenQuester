import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { usePackageBrowser } from "./usePackageBrowser";
import type * as PackageQueries from "./usePackages";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({ q: "initial", id: 42 }),
  useNavigate: () => navigate,
}));
vi.mock("@/features/auth/useMe", () => ({
  useMe: () => ({ data: { id: 1, isGuest: false } }),
}));
vi.mock("./usePackages", async (importOriginal) => ({
  ...(await importOriginal<typeof PackageQueries>()),
  usePackages: () => ({ data: { total: 49, items: [] } }),
}));

afterEach(() => vi.useRealTimers());

it("debounces the latest search without losing filters, resets paging and clears the timer on exit", () => {
  vi.useFakeTimers();
  const { result, unmount } = renderHook(() => usePackageBrowser());
  expect(result.current.query).toBe("initial");
  expect(result.current.selectedId).toBe(42);
  expect(result.current.pages).toBe(3);
  act(() => vi.advanceTimersByTime(250));
  act(() => result.current.setPage(2));
  act(() => result.current.setQuery("city"));
  act(() => vi.advanceTimersByTime(200));
  expect(result.current.filters.title).toBe("initial");
  expect(result.current.page).toBe(2);
  act(() => result.current.setQuery("cities"));
  act(() => result.current.change({ language: "uk", age: "A12" }));
  expect(result.current.page).toBe(0);
  act(() => vi.advanceTimersByTime(249));
  expect(result.current.filters.title).toBe("initial");
  act(() => result.current.setPage(1));
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.filters).toMatchObject({ title: "cities", language: "uk", age: "A12" });
  expect(result.current.extra).toBe(1);
  expect(result.current.page).toBe(0);

  act(() => result.current.select(8));
  const navigation = navigate.mock.calls.at(-1)![0];
  expect(navigation.replace).toBe(true);
  expect(navigation.search({ q: "kept", id: 42 })).toEqual({ q: "kept", id: 8 });
  act(() => result.current.select(undefined));
  expect(navigate.mock.calls.at(-1)![0].search({ q: "kept", id: 8 })).toEqual({
    q: "kept",
    id: undefined,
  });
  act(() => result.current.setQuery("discard pending search"));
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

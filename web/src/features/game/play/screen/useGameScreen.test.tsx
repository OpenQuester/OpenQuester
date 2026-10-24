import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useSettings } from "@/features/settings/settingsStore";
import type { GameConnection } from "@/game/connection";
import { ALICE, choosing, SHOWMAN } from "@/game/fixtures";
import { useGameStore } from "@/game/store";
import { GameContext } from "../../GameContext";
import { useGameScreen } from "./useGameScreen";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useSettings.getState().update({ pins: {} });
});

it("preserves desktop pins across a narrow layout, enforces roles and releases listeners", () => {
  let wide = true;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({
    matches: wide,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  const added = vi.spyOn(window, "addEventListener");
  const removed = vi.spyOn(window, "removeEventListener");
  useGameStore.setState({ session: choosing(), pending: null, connection: "connected" });
  useSettings.getState().update({ pins: {}, sound: false });
  const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
  const { result, unmount } = renderHook(useGameScreen, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <GameContext.Provider value={{ connection, myId: SHOWMAN }}>{children}</GameContext.Provider>
    ),
  });

  act(() => result.current.togglePin("chat"));
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  expect(result.current.isOpen("chat")).toBe(true);
  act(() => {
    wide = false;
    [...listeners].forEach((listener) => listener());
  });
  expect(result.current.isOpen("chat")).toBe(false);
  expect(useSettings.getState().pins.chat).toBe(true);
  act(() => {
    wide = true;
    [...listeners].forEach((listener) => listener());
  });
  expect(result.current.isOpen("chat")).toBe(true);
  act(() => result.current.setPanel("chat", false));
  expect(useSettings.getState().pins.chat).toBe(false);

  act(() => {
    result.current.setFocusPlayer(ALICE);
    result.current.setPanel("host", true);
  });
  expect(result.current.focusPlayer).toBe(ALICE);
  act(() => result.current.setPanel("host", false));
  expect(result.current.focusPlayer).toBeNull();
  act(() => result.current.togglePin("host"));
  act(() => {
    const current = useGameStore.getState().session!;
    useGameStore.setState({
      session: {
        ...current,
        players: current.players.map((player) =>
          player.meta.id === SHOWMAN ? { ...player, role: "spectator" } : player,
        ),
      },
    });
  });
  expect(result.current.isOpen("host")).toBe(false);
  expect(result.current.docked).not.toContain("host");
  unmount();
  expect(listeners.size).toBe(0);
  const keyListeners = added.mock.calls.filter(([event]) => String(event) === "keydown");
  expect(keyListeners.length).toBeGreaterThan(0);
  for (const [event, listener] of keyListeners) {
    expect(
      removed.mock.calls.some(
        ([removedEvent, removedListener]) => removedEvent === event && removedListener === listener,
      ),
    ).toBe(true);
  }
});

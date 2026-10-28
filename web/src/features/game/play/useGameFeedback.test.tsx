import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { GameConnection } from "@/game/connection";
import { ALICE, choosing, SHOWMAN } from "@/game/fixtures";
import { useGameStore } from "@/game/store";
import { useSettings } from "@/features/settings/settingsStore";
import { i18n } from "@/i18n";
import { GameContext } from "../GameContext";
import { logLine } from "./chat/logLine";
import { useGameFeedback } from "./useGameFeedback";

const { playCue } = vi.hoisted(() => ({ playCue: vi.fn() }));
vi.mock("@/lib/sound", () => ({ playCue }));

afterEach(async () => {
  cleanup();
  playCue.mockReset();
  useSettings.getState().update({ sound: false });
  await i18n.changeLanguage("en");
});

it.each([
  ["en", "user2's answer was skipped, 0", "skipped user2's answer (0)"],
  ["uk", "відповідь user2 пропущено, 0", "пропустив відповідь user2 (0)"],
  ["ru", "ответ user2 пропущен, 0", "пропустил ответ user2 (0)"],
])(
  "announces and logs a neutral skip in %s without a wrong cue",
  async (language, expected, chat) => {
    useSettings.getState().update({ sound: true, volume: 0.5 });
    await i18n.changeLanguage(language);
    useGameStore.setState({ session: choosing(), connection: "connected", pending: null });
    const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
    const { result } = renderHook(useGameFeedback, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <GameContext.Provider value={{ connection, myId: SHOWMAN }}>
          {children}
        </GameContext.Provider>
      ),
    });
    const judge = (answerType: "skip" | "correct" | "wrong", key: number, points: number) => {
      act(() => {
        const current = useGameStore.getState().session!;
        useGameStore.setState({
          session: {
            ...current,
            lastResult: { key, player: ALICE, result: points, score: 100, answerType },
          },
        });
      });
    };
    judge("skip", 1, 0);
    expect(result.current).toBe(expected);
    expect(playCue).not.toHaveBeenCalled();
    const t = (key: string, options?: Record<string, unknown>) => String(i18n.t(key, options));
    expect(
      logLine(
        t,
        { action: "answer-result", params: { player: "user2", answerType: "skip", points: 0 } },
        "fallback",
      ),
    ).toBe(chat);

    judge("correct", 2, 100);
    judge("wrong", 3, -100);
    expect(playCue.mock.calls.map(([cue]) => cue)).toEqual(["correct", "wrong"]);
    expect(
      logLine(
        t,
        {
          action: "answer-result",
          params: { player: "user2", answerType: "correct", points: 100 },
        },
        "fallback",
      ),
    ).toContain("+100");
    expect(
      logLine(
        t,
        { action: "answer-result", params: { player: "user2", answerType: "wrong", points: -100 } },
        "fallback",
      ),
    ).toContain("−100");
  },
);

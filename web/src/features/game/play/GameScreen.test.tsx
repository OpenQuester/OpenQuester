import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { GameConnection } from "@/game/connection";
import { ALICE, BOB, choosing } from "@/game/fixtures";
import type { ChatMessage } from "@/game/protocol";
import { useGameStore } from "@/game/store";
import { GameContext } from "../GameContext";
import { GameScreen } from "./GameScreen";

vi.mock("@/features/stats/ReportQuestion", () => ({ ReportQuestionDialog: () => null }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("counts only player messages, clears the badge on read, and handles a full chat history", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Element.prototype.scrollTo = vi.fn();
  const message = (uuid: string, system = false): ChatMessage => ({
    uuid,
    user: BOB,
    timestamp: new Date().toISOString(),
    message: uuid,
    ...(system ? { system: { action: "start", params: {} } } : {}),
  });
  useGameStore.setState({
    session: { ...choosing(), chat: [message("already-read")] },
    connection: "connected",
    pending: null,
  });
  const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
  render(
    <GameContext.Provider value={{ connection, myId: ALICE }}>
      <GameScreen />
    </GameContext.Provider>,
  );
  const add = (m: ChatMessage) =>
    act(() => {
      const session = useGameStore.getState().session!;
      useGameStore.setState({ session: { ...session, chat: [...session.chat, m].slice(-200) } });
    });
  const badge = () => within(screen.getByTestId("open-chat")).queryByLabelText(/unread/i);
  add(message("system-1", true));
  expect(badge()).not.toBeInTheDocument();
  add(message("hello"));
  add(message("system-2", true));
  expect(badge()).toHaveTextContent("1");
  await userEvent.click(screen.getByTestId("open-chat"));
  expect(badge()).not.toBeInTheDocument();
  expect(screen.getAllByTestId("chat-message").map((m) => m.textContent)).toEqual([
    "user3already-read",
    "user3hello",
  ]);
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  for (let i = 0; i < 200; i++) add(message(`log-${i}`, true));
  expect(badge()).not.toBeInTheDocument();
  add(message("new-message"));
  expect(badge()).toHaveTextContent("1");
});

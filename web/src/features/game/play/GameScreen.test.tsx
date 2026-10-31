import { act, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { GameConnection } from "@/game/connection";
import { ALICE, BOB, choosing, snapshot } from "@/game/fixtures";
import type { ChatMessage } from "@/game/protocol";
import { useGameStore } from "@/game/store";
import { GameContext } from "../GameContext";
import { GameScreen } from "./GameScreen";

vi.mock("@/features/stats/QuestionReporting", () => ({ ReportQuestionDialog: () => null }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function message(uuid: string, system = false): ChatMessage {
  return {
    uuid,
    user: BOB,
    timestamp: "2026-10-18T12:00:00.000Z",
    message: uuid,
    ...(system ? { system: { action: "start", params: {} } } : {}),
  };
}

function setup(chat: ChatMessage[]) {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const scrollTo = vi.fn();
  Element.prototype.scrollTo = scrollTo;
  useGameStore.setState({
    gameId: "ABCD",
    session: { ...choosing(), chat },
    connection: "connected",
    pending: null,
  });
  const connection = { emit: vi.fn(), connected: true } as unknown as GameConnection;
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
  render(
    <QueryClientProvider client={client}>
      <GameContext.Provider value={{ connection, myId: ALICE }}>
        <GameScreen />
      </GameContext.Provider>
    </QueryClientProvider>,
  );
  const add = (m: ChatMessage) =>
    act(() => {
      const session = useGameStore.getState().session!;
      useGameStore.setState({ session: { ...session, chat: [...session.chat, m].slice(-200) } });
    });
  const badge = () => within(screen.getByTestId("open-chat")).queryByLabelText(/unread/i);
  const reconnect = (chat: ChatMessage[]) =>
    act(() => {
      const session = useGameStore.getState().session!;
      useGameStore.getState().dispatch({
        type: "game-data",
        payload: { ...snapshot(session.state), chatMessages: chat },
      });
    });
  return { add, badge, reconnect, scrollTo };
}

it("counts only player messages, clears the badge on read, and handles a full chat history", async () => {
  const { add, badge } = setup([message("already-read")]);
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

it("reports a skipped ruling neutrally in the live announcement and game log", async () => {
  setup([]);
  act(() => {
    const session = useGameStore.getState().session!;
    useGameStore.setState({
      session: {
        ...session,
        lastResult: { key: 1, player: BOB, result: 0, score: 0, answerType: "skip" },
        chat: [
          {
            ...message("skip", true),
            message: "Showman judged user3 wrong (0)",
            system: {
              action: "answer-result",
              params: { player: "user3", answerType: "skip", points: 0 },
            },
          },
        ],
      },
    });
  });
  expect(screen.getByRole("status")).toHaveTextContent("user3's answer was skipped, 0");
  await userEvent.click(screen.getByTestId("open-chat"));
  expect(screen.getByTestId("chat-log")).toHaveTextContent("skipped user3's answer (0)");
  expect(screen.getByTestId("chat-log")).not.toHaveTextContent("wrong");
});

it("keeps read messages read when a reconnect reorders equal timestamps", async () => {
  const a = message("A");
  const b = message("B");
  const unseen = message("new-message");
  const { badge, reconnect } = setup([a, b]);

  reconnect([b, a]);
  expect(badge()).not.toBeInTheDocument();
  reconnect([b, unseen, a]);
  expect(badge()).toHaveTextContent("1");
  await userEvent.click(screen.getByTestId("open-chat"));
  expect(badge()).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  reconnect([a, b, unseen]);
  expect(badge()).not.toBeInTheDocument();
});

it("retains read UUIDs when a reconnect supplies a shorter history", async () => {
  const a = message("A");
  const b = message("B");
  const c = message("C");
  const { badge, reconnect } = setup([a, b]);
  await userEvent.click(screen.getByTestId("open-chat"));
  reconnect([b, c]);
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  reconnect([a, b, c]);
  expect(badge()).not.toBeInTheDocument();
});

it("scrolls to new messages after the chat history reaches its limit", async () => {
  const { add, scrollTo } = setup(Array.from({ length: 200 }, (_, i) => message(`read-${i}`)));
  await userEvent.click(screen.getByTestId("open-chat"));
  const list = screen.getByTestId("chat-panel").firstElementChild!;
  Object.defineProperty(list, "scrollHeight", { value: 6000 });
  scrollTo.mockClear();
  add(message("new-message"));
  expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 6000 });
});

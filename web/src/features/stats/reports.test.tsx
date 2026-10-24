import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { GameContext } from "@/features/game/GameContext";
import type { GameConnection } from "@/game/connection";
import { session } from "@/game/fixtures";
import { useGameStore } from "@/game/store";
import { PackageReports } from "./PackageReports";
import { ReportQuestionButton, ReportQuestionDialog } from "./QuestionReporting";
import { useReportStore } from "./questionReportStore";
import { useReportQuestion } from "./useStats";

vi.mock("@/api/config", () => ({ API_URL: "http://api.test" }));
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  globalThis.fetch = mock;
  return mock;
});
const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
  fetchMock.mockReset();
  useReportStore.setState({ scope: "", questionId: null, sent: [] });
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  clients.push(client);
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const report = {
  id: 1,
  packageId: 7,
  questionId: 100,
  reason: "wrong_answer",
  questionText: "Question?",
  createdAt: new Date().toISOString(),
  resolved: false,
};

it("exposes a failed report list, retries it, and preserves the report after a rejected resolution", async () => {
  const { wrapper } = setup();
  fetchMock.mockResolvedValueOnce(json({ message: "List unavailable" }, 503));
  render(<PackageReports packageId={7} title="Quiz" />, { wrapper });
  await userEvent.click(await screen.findByTestId("package-reports"));
  expect(screen.getByRole("alert")).toHaveTextContent("List unavailable");
  fetchMock.mockImplementation(async (input) =>
    (input as Request).method === "PATCH"
      ? json({ message: "Save refused" }, 403)
      : json({ data: [report], open: 1 }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await userEvent.click(await screen.findByRole("button", { name: "Mark resolved" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Save refused");
  expect(screen.getByTestId("package-report")).toHaveTextContent("Question?");
  expect(screen.getByRole("button", { name: "Mark resolved" })).toBeEnabled();
});

it("invalidates the author's cached report list when a new report is accepted", async () => {
  const { client, wrapper } = setup();
  const key = ["packages", 7, "reports"];
  client.setQueryData(key, { data: [], open: 0 });
  fetchMock.mockResolvedValue(json(report));
  const { result } = renderHook(() => useReportQuestion("ABCD"), { wrapper });
  await act(() => result.current.mutateAsync({ questionId: 100, reason: "wrong_answer" }));
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
});

it("keeps open and sent reports scoped to the game and user, including a late response", async () => {
  const { wrapper } = setup();
  const connection = {} as GameConnection;
  useGameStore.setState({ session: session() });
  const view = (myId: number, gameId = "ABCD") => (
    <GameContext.Provider value={{ connection, myId }}>
      <ReportQuestionButton questionId={100} />
      <ReportQuestionDialog gameId={gameId} />
    </GameContext.Provider>
  );
  const { rerender } = render(view(2), { wrapper });
  await userEvent.click(screen.getByTestId("report-question"));
  expect(screen.getByRole("dialog")).toBeVisible();
  rerender(view(3));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await userEvent.click(screen.getByTestId("report-question"));
  act(() => useReportStore.getState().markSent("ABCD:2", 100));
  expect(screen.getByRole("dialog")).toBeVisible();
  act(() => useReportStore.getState().markSent("ABCD:3", 100));
  expect(screen.getByTestId("report-sent")).toBeVisible();
  act(() => useGameStore.setState({ session: { ...session(), gameId: "NEXT" } }));
  rerender(view(3, "NEXT"));
  expect(screen.getByTestId("report-question")).toBeVisible();
  expect(screen.queryByRole("dialog")).toBeNull();
});

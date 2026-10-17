import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/config", () => ({ API_URL: "http://api.test" }));
const fetchMock = vi.hoisted(() => {
  const mock = vi.fn<typeof fetch>();
  globalThis.fetch = mock;
  return mock;
});

import { AdminPage } from "./AdminPage";

afterEach(() => fetchMock.mockReset());

describe("admin users permission", () => {
  it.each(["get_all_users", "view_users_info"])(
    "uses the endpoint permission for a staff member with only %s",
    async (permission) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      });
      client.setQueryData(["me"], {
        id: 1,
        username: "Staff",
        permissions: [{ name: "admin_panel_access" }, { name: permission }],
      });
      client.setQueryData(["admin", "dashboard"], {
        totalUsers: 1,
        activeUsers: 1,
        guestsUsers: 0,
        deletedUsers: 0,
        systemHealth: { serverUptimeSeconds: 120, redisConnected: true, redisKeys: 10 },
        recentUsers: [],
      });
      fetchMock.mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              data: [],
              pageInfo: { total: 0 },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      );
      render(
        <QueryClientProvider client={client}>
          <AdminPage />
        </QueryClientProvider>,
      );

      if (permission === "get_all_users") {
        expect(screen.queryByRole("tab", { name: "Users" })).not.toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
      } else {
        await userEvent.setup().click(screen.getByRole("tab", { name: "Users" }));
        expect(await screen.findByText("No users match.")).toBeVisible();
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(new URL((fetchMock.mock.calls[0]![0] as Request).url).pathname).toBe(
          "/v1/admin/api/users",
        );
      }
    },
  );
});

describe("admin system health", () => {
  it("displays server memory in the MB units returned by the API", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(["me"], {
      id: 1,
      username: "Admin",
      permissions: [{ name: "admin_panel_access" }, { name: "view_system_health" }],
    });
    client.setQueryData(["admin", "dashboard"], {
      totalUsers: 1,
      activeUsers: 1,
      guestsUsers: 0,
      deletedUsers: 0,
      systemHealth: { serverUptimeSeconds: 120, redisConnected: true, redisKeys: 10 },
      recentUsers: [],
    });
    client.setQueryData(["admin", "health"], {
      health: {
        redis: { connected: true, estimatedMemoryMB: 1.5, keys: 10 },
        server: { uptime: 120, memory: { used: 100, total: 8192 } },
      },
      ping: { ok: true, eventLoopLagMs: 0.1, redis: { responseMs: 1 } },
    });
    render(
      <QueryClientProvider client={client}>
        <AdminPage />
      </QueryClientProvider>,
    );
    await userEvent.setup().click(screen.getByRole("tab", { name: "System" }));
    expect(screen.getByText("100 MB / 8192 MB")).toBeVisible();
    expect(screen.getByText("1.5 MB")).toBeVisible();
  });
});

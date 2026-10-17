import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdminPage } from "./AdminPage";

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

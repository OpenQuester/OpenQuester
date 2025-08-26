import { createApiClient } from "@/api/client";
import type {
  AdminDashboardData,
  AdminUserListData,
  PaginationOrder,
  SystemHealthData,
  UserType,
} from "@/types/dto";
import type { UserStatus } from "@/types/userStatus";

interface ApiErrorPayload {
  message?: string;
  error?: string;
  [k: string]: unknown;
}

interface GetUserParams {
  sortBy?: string;
  order?: PaginationOrder;
  limit?: number;
  offset?: number;
  search?: string;
  status?: UserStatus;
  userType?: UserType;
}

interface PingData {
  ok: boolean;
  eventLoopLagMs: number;
  redis: { connected: boolean; responseMs: number | null };
  timestamp: string;
}

interface GetDashboardParams {
  timeframe?: number;
}

export class ApiError extends Error {
  public readonly status?: number;
  public readonly payload?: ApiErrorPayload;
  public readonly op: string;

  constructor(op: string, raw: unknown) {
    const res = (raw as any)?.response;
    const payload: ApiErrorPayload | undefined = res?.data;
    const base =
      payload?.message ||
      payload?.error ||
      (raw instanceof Error ? raw.message : "Request failed");
    super(`[${op}] ${base}`);
    this.op = op;
    this.status = res?.status;
    this.payload = payload;
    if (raw instanceof Error && raw.stack) {
      this.stack += `\nCaused by: ${raw.stack}`;
    }
  }
}

const adminClient = createApiClient("/v1/admin/api");

async function wrap<T>(op: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new ApiError(op, err);
  }
}

export const adminApi = {
  // Summary metrics + recent items
  getDashboard: async (
    params?: GetDashboardParams
  ): Promise<AdminDashboardData> =>
    wrap("dashboard.fetch", async () => {
      const { data } = await adminClient.get("/dashboard", { params });
      return normalizeDashboard(data);
    }),

  // Paged users list with stats
  getUsers: async (params?: GetUserParams): Promise<AdminUserListData> =>
    wrap("users.list", async () => {
      const { data } = await adminClient.get("/users", { params });
      return data;
    }),

  // Infra + runtime snapshot
  getSystemHealth: async (): Promise<SystemHealthData> =>
    wrap("system.health", async () => {
      const { data } = await adminClient.get("/system/health");
      return data;
    }),

  getPing: async (): Promise<PingData> =>
    wrap("system.ping", async () => {
      const { data } = await adminClient.get("/system/ping");
      return data;
    }),

  // Placeholder until ban logic implemented server-side
  banUser: async (userId: number) =>
    wrap("user.ban", async () => {
      const { data } = await adminClient.post(`/users/${userId}/ban`);
      return data;
    }),

  unbanUser: async (userId: number) =>
    wrap("user.unban", async () => {
      const { data } = await adminClient.post(`/users/${userId}/unban`);
      return data;
    }),

  restoreUser: async (userId: number) =>
    wrap("user.restore", async () => {
      const { data } = await adminClient.post(`/users/restore/${userId}`);
      return data;
    }),

  deleteUser: async (userId: number) =>
    wrap("user.delete", async () => {
      const { data } = await adminClient.delete(`/users/${userId}`);
      return data;
    }),
};

// Normalization to tolerate snake_case backend keys until unified contract
function normalizeDashboard(raw: any): AdminDashboardData {
  const systemRaw = raw.systemHealth || raw.system_health || {};
  const recent = raw.recentUsers || raw.recent_users || [];
  return {
    totalUsers: raw.totalUsers ?? raw.total_users ?? 0,
    activeUsers: raw.activeUsers ?? raw.active_users ?? 0,
    deletedUsers: raw.deletedUsers ?? raw.deleted_users ?? 0,
    recentUsers: Array.isArray(recent) ? recent : [],
    systemHealth: {
      redisConnected:
        systemRaw.redisConnected ?? systemRaw.redis_connected ?? false,
      redisKeys: systemRaw.redisKeys ?? systemRaw.redis_keys ?? 0,
      serverUptimeSeconds:
        systemRaw.serverUptimeSeconds ?? systemRaw.server_uptime_seconds ?? 0,
    },
  };
}

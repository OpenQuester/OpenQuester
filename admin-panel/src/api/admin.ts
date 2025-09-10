import { createApiClient } from "@/api/client";
import { wrap } from "@/api/errors";
import type {
  AdminDashboardData,
  AdminUserListData,
  PaginatedResult,
  PaginationOrder,
  SystemHealthData,
  UserType,
} from "@/types/dto";
import type { AdminPackageDTO } from "@/types/package";
import type { UserStatus } from "@/types/userStatus";

interface GetUserParams {
  sortBy?: string;
  order?: PaginationOrder;
  limit?: number;
  offset?: number;
  search?: string;
  status?: UserStatus;
  userType?: UserType;
}

interface GetPackagesParams {
  sortBy?: string;
  order?: PaginationOrder;
  limit?: number;
  offset?: number;
  title?: string;
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

const adminClient = createApiClient("/v1/admin/api");
const packagesClient = createApiClient("/v1");

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

  // Packages list - uses existing public packages endpoint
  getPackages: async (
    params?: GetPackagesParams
  ): Promise<PaginatedResult<AdminPackageDTO[]>> =>
    wrap("packages.list", async () => {
      const { data } = await packagesClient.get("/packages", { params });
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

  // Delete package
  deletePackage: async (packageId: number) =>
    wrap("package.delete", async () => {
      const { data } = await packagesClient.delete(`/packages/${packageId}`);
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

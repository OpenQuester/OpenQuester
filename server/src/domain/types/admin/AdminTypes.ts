import { UserDTO } from "domain/types/dto/user/UserDTO";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";

export interface UsersStats {
  total: number;
  active: number;
  deleted: number;
  banned: number;
}

export interface AdminDashboardData {
  totalUsers: number;
  activeUsers: number;
  deletedUsers: number;
  recentUsers: UserDTO[];
  systemHealth: {
    redisConnected: boolean;
    redisKeys: number;
    serverUptimeSeconds: number; // seconds since process start
  };
}

export interface AdminUserListData extends PaginatedResult<UserDTO[]> {
  stats: UsersStats;
}

export interface AdminSystemHealthData {
  redis: {
    connected: boolean;
    keys: number;
    estimatedMemoryBytes: number;
    estimatedMemoryMB: number;
    averageKeySizeKB: number;
  };
  server: {
    uptime: number; // seconds
    memory: { used: number; total: number }; // MB values
  };
  timestamp: Date; // server timestamp of measurement
}

export interface AdminPingData {
  ok: boolean;
  eventLoopLagMs: number;
  redis: { connected: boolean; responseMs: number | null };
  timestamp: string; // ISO string
}

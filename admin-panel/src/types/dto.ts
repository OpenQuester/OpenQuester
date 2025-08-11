export interface UserDTO {
  id: number;
  username: string;
  email: string;
  discordId: string | null;
  isDeleted: boolean;
  isBanned?: boolean;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  avatar: string | null; // server returns URL or null
  permissions: Array<{ id: number; name: string }>;
  // optional fields potentially present
  birthday?: string | null;
}

export interface PaginatedResult<T> {
  data: T;
  pageInfo: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface AdminDashboardData {
  totalUsers: number;
  activeUsers: number;
  deletedUsers: number;
  recentUsers: UserDTO[];
  systemHealth: {
    redisConnected: boolean;
    redisKeys: number;
    serverUptimeSeconds?: number;
  };
}

export interface AdminUserListData extends PaginatedResult<UserDTO[]> {
  stats: {
    total: number;
    active: number;
    deleted: number;
    banned: number;
  };
}

export interface SystemHealthData {
  redis: {
    connected: boolean;
    keys: number;
    estimatedMemoryBytes: number;
    estimatedMemoryMB: number;
    averageKeySizeKB: number;
  };
  server: {
    uptime: number;
    memory: { used: number; total: number };
  };
  timestamp: string;
}

export enum PaginationOrder {
  ASC = "asc",
  DESC = "desc",
}

export enum DashboardRecentTimeframe {
  ONE_DAY = 1,
  SEVEN_DAYS = 7,
  FOURTEEN_DAYS = 14,
  THIRTY_ONE_DAYS = 31,
}

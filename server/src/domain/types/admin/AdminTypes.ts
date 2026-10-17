import { type StaffRole } from "domain/constants/staffRoles";
import { type GameListItemDTO } from "domain/types/dto/game/GameListItemDTO";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { type PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { type PlayerRole } from "domain/types/game/PlayerRole";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";

export interface UsersStats {
  total: number;
  active: number;
  deleted: number;
  banned: number;
  guests: number;
}

export interface AdminDashboardData {
  totalUsers: number;
  activeUsers: number;
  deletedUsers: number;
  guestsUsers: number;
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

export interface AdminGameListQuery {
  limit: number;
  offset: number;
  search?: string;
}

export type AdminGameListData = PaginatedResult<GameListItemDTO[]>;

export interface AdminGamePlayer {
  id: number;
  username: string;
  avatar: string | null;
  role: PlayerRole;
  status: PlayerGameStatus;
  score: number;
  slot: number | null;
}

export interface AdminGameDetailsData {
  game: GameListItemDTO;
  isPaused: boolean;
  players: AdminGamePlayer[];
}

/** A role preset: the permissions a staff role starts with. */
export interface AdminRolePreset {
  id: StaffRole;
  permissions: string[];
}

export interface AdminRolesData {
  /** Every permission, in display order. */
  permissions: string[];
  /** Presets an admin can apply; permissions can then be ticked one by one. */
  roles: AdminRolePreset[];
}

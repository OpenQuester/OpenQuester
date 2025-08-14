import { freemem } from "os";

import { UserService } from "application/services/user/UserService";
import {
  ADMIN_AVERAGE_REDIS_KEY_SIZE_KB,
  ADMIN_RECENT_USERS_LIMIT,
} from "domain/constants/admin";
import {
  AdminDashboardData,
  AdminSystemHealthData,
  AdminUserListData,
  UsersStats,
} from "domain/types/admin/AdminTypes";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { UserPaginationOpts } from "domain/types/pagination/user/UserPaginationOpts";
import { ILogger } from "infrastructure/logger/ILogger";
import { RedisService } from "infrastructure/services/redis/RedisService";

interface RedisSnapshot {
  keys: number;
  connected: boolean;
}

/**
 * Encapsulates admin-specific aggregation and system health logic.
 */
export class AdminService {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly logger: ILogger
  ) {
    //
  }

  public async getUserStats(): Promise<UsersStats> {
    const total = await this.userService.count({});

    const deleted = await this.userService.count({ is_deleted: true });
    const banned = await this.userService.count({ is_banned: true });

    return { total, deleted, active: total - (deleted + banned), banned };
  }

  public async getRecentUsers(
    limit: number = ADMIN_RECENT_USERS_LIMIT,
    since?: Date
  ): Promise<PaginatedResult<UserDTO[]>> {
    const users = await this.userService.listRecent(
      limit,
      {
        select: [
          "id",
          "username",
          "name",
          "email",
          "discord_id",
          "created_at",
          "updated_at",
          "is_banned",
          "is_deleted",
          "is_guest",
        ],
        relations: ["permissions"],
        relationSelects: { permissions: ["id", "name"] },
      },
      since
    );
    const data: UserDTO[] = users.map((u) => u.toDTO());
    return {
      data,
      pageInfo: {
        total: data.length,
      },
    };
  }

  private async getRedisSnapshot(): Promise<RedisSnapshot> {
    try {
      const allKeys = await this.redisService.scan("*");
      return { keys: allKeys.length, connected: true };
    } catch (error) {
      this.logger.error("Failed to scan Redis keys", {
        prefix: "[ADMIN]: ",
        error: error instanceof Error ? error.message : String(error),
      });
      return { keys: 0, connected: false };
    }
  }

  /** Compute system health for admin usage. */
  public async getSystemHealth(): Promise<AdminSystemHealthData> {
    const redis = await this.getRedisSnapshot();

    const estimatedMemoryKB = Math.round(
      redis.keys * ADMIN_AVERAGE_REDIS_KEY_SIZE_KB
    );
    const estimatedMemoryBytes = estimatedMemoryKB * 1024;
    const estimatedMemoryMB = +(estimatedMemoryKB / 1024).toFixed(2);

    return {
      redis: {
        connected: redis.connected,
        keys: redis.keys,
        estimatedMemoryBytes,
        estimatedMemoryMB,
        averageKeySizeKB: ADMIN_AVERAGE_REDIS_KEY_SIZE_KB,
      },
      server: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(freemem() / 1024 / 1024),
        },
      },
      timestamp: new Date(),
    };
  }

  public async getDashboardData(options?: {
    timeframeDays?: number;
  }): Promise<AdminDashboardData> {
    const stats = await this.getUserStats();
    let since: Date | undefined;
    if (options?.timeframeDays && options.timeframeDays > 0) {
      since = new Date(
        Date.now() - options.timeframeDays * 24 * 60 * 60 * 1000
      );
    }
    const recentUsersPaginated = await this.getRecentUsers(undefined, since);
    const redis = await this.getRedisSnapshot();

    return {
      totalUsers: stats.total,
      activeUsers: stats.active,
      deletedUsers: stats.deleted,
      recentUsers: recentUsersPaginated.data,
      systemHealth: {
        redisConnected: redis.connected,
        redisKeys: redis.keys,
        serverUptimeSeconds: process.uptime(),
      },
    };
  }

  /** List users with stats (admin view). */
  public async listUsersWithStats(
    opts: UserPaginationOpts
  ): Promise<AdminUserListData> {
    const listResult = await this.userService.list(opts);
    const stats = await this.getUserStats();

    return {
      data: listResult.data,
      pageInfo: { total: listResult.pageInfo.total },
      stats: {
        total: stats.total,
        active: stats.active,
        deleted: stats.deleted,
        banned: stats.banned,
      },
    };
  }
}

import { freemem } from "os";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { UserService } from "application/services/user/UserService";
import { ADMIN_AVERAGE_REDIS_KEY_SIZE_KB, ADMIN_RECENT_USERS_LIMIT } from "domain/constants/admin";
import {
  ADMIN_PERMISSIONS,
  MODERATOR_DEFAULT_PERMISSIONS,
  StaffRole,
  staffRoleOf
} from "domain/constants/staffRoles";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { Permissions } from "domain/enums/Permissions";
import { ClientError } from "domain/errors/ClientError";
import { asUserId, type userId } from "domain/types/ids";
import {
  AdminDashboardData,
  AdminRolesData,
  AdminSystemHealthData,
  AdminUserListData,
  UsersStats
} from "domain/types/admin/AdminTypes";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { UserPaginationOpts } from "domain/types/pagination/user/UserPaginationOpts";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { RedisService } from "application/services/redis/RedisService";

interface RedisSnapshot {
  keys: number;
  connected: boolean;
}

/**
 * Encapsulates admin-specific aggregation and system health logic.
 */
@singleton()
export class AdminService {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  public async getUserStats(): Promise<UsersStats> {
    return this.userService.getStats();
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
          "is_guest"
        ],
        relations: ["permissions", "avatar"],
        relationSelects: {
          permissions: ["id", "name"],
          avatar: ["id", "filename"]
        }
      },
      since
    );
    const data: UserDTO[] = users.map((u) => this.userService.toDTO(u));

    return {
      data,
      pageInfo: {
        total: data.length
      }
    };
  }

  private async getRedisSnapshot(): Promise<RedisSnapshot> {
    try {
      const allKeys = await this.redisService.scan("*");

      return { keys: allKeys.length, connected: true };
    } catch (error) {
      this.logger.error("Failed to scan Redis keys", {
        prefix: LogPrefix.ADMIN,
        error: error instanceof Error ? error.message : String(error)
      });

      return { keys: 0, connected: false };
    }
  }

  /** Compute system health for admin usage. */
  public async getSystemHealth(): Promise<AdminSystemHealthData> {
    const redis = await this.getRedisSnapshot();

    const estimatedMemoryKB = Math.round(redis.keys * ADMIN_AVERAGE_REDIS_KEY_SIZE_KB);
    const estimatedMemoryBytes = estimatedMemoryKB * 1024;
    const estimatedMemoryMB = +(estimatedMemoryKB / 1024).toFixed(2);

    return {
      redis: {
        connected: redis.connected,
        keys: redis.keys,
        estimatedMemoryBytes,
        estimatedMemoryMB,
        averageKeySizeKB: ADMIN_AVERAGE_REDIS_KEY_SIZE_KB
      },
      server: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(freemem() / 1024 / 1024)
        }
      },
      timestamp: new Date()
    };
  }

  public async getDashboardData(options?: { timeframeDays?: number }): Promise<AdminDashboardData> {
    const stats = await this.getUserStats();
    let since: Date | undefined;
    if (options?.timeframeDays && options.timeframeDays > 0) {
      since = new Date(Date.now() - options.timeframeDays * 24 * 60 * 60 * 1000);
    }

    const recentUsersPaginated = await this.getRecentUsers(undefined, since);
    const redis = await this.getRedisSnapshot();

    return {
      totalUsers: stats.total,
      activeUsers: stats.active,
      deletedUsers: stats.deleted,
      guestsUsers: stats.guests,
      recentUsers: recentUsersPaginated.data,
      systemHealth: {
        redisConnected: redis.connected,
        redisKeys: redis.keys,
        serverUptimeSeconds: process.uptime()
      }
    };
  }

  /** List users with stats (admin view). */
  public async listUsersWithStats(opts: UserPaginationOpts): Promise<AdminUserListData> {
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
        guests: stats.guests
      }
    };
  }

  /** Permission list and the role presets the admin panel offers. */
  public getRoles(): AdminRolesData {
    return {
      permissions: [...ADMIN_PERMISSIONS],
      roles: [
        { id: StaffRole.USER, permissions: [] },
        { id: StaffRole.MODERATOR, permissions: [...MODERATOR_DEFAULT_PERMISSIONS] },
        { id: StaffRole.ADMIN, permissions: [...ADMIN_PERMISSIONS] }
      ]
    };
  }

  /**
   * Guards every admin action on another account: nobody acts on themselves,
   * and only admins act on staff (admins and moderators).
   */
  public async assertCanModerateUser(
    actorId: number | undefined,
    targetId: userId,
    allowDeletedTarget = false
  ): Promise<void> {
    if (actorId === undefined) {
      throw new ClientError(ClientResponse.ACCESS_DENIED, HttpStatus.UNAUTHORIZED);
    }

    if (actorId === targetId) {
      throw new ClientError(ClientResponse.CANNOT_MODERATE_SELF, HttpStatus.FORBIDDEN);
    }

    const users = await this.userService.getManyRaw(
      [asUserId(actorId), targetId],
      {
        select: ["id"],
        relations: ["permissions"],
        relationSelects: { permissions: ["id", "name"] }
      },
      allowDeletedTarget ? [targetId] : []
    );
    const roles = new Map(
      users.map((user) => [
        user.id,
        staffRoleOf(user.permissions?.map((permission) => permission.name) ?? [])
      ])
    );

    if (
      roles.get(targetId) !== StaffRole.USER &&
      roles.get(asUserId(actorId)) !== StaffRole.ADMIN
    ) {
      throw new ClientError(ClientResponse.CANNOT_MODERATE_STAFF, HttpStatus.FORBIDDEN);
    }
  }

  /** Replaces a user's permissions; the admin panel's role and permission editor. */
  public async setUserPermissions(
    actorId: number | undefined,
    targetId: userId,
    permissionNames: string[]
  ): Promise<UserDTO> {
    await this.assertCanModerateUser(actorId, targetId);

    const unknown = permissionNames.filter(
      (name) => !ADMIN_PERMISSIONS.includes(name as Permissions)
    );
    if (unknown.length > 0) {
      throw new ClientError(ClientResponse.INVALID_INPUT, HttpStatus.BAD_REQUEST);
    }

    const updated = await this.userService.updateUserPermissionsByNames(targetId, [
      ...new Set(permissionNames)
    ]);

    this.logger.audit("Staff permissions changed", {
      prefix: LogPrefix.ADMIN,
      adminUserId: actorId,
      targetUserId: targetId,
      role: staffRoleOf(permissionNames),
      permissions: permissionNames
    });

    return updated;
  }
}

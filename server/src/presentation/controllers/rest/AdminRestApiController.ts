import { type Express, type Request, type Response, Router } from "express";
import Joi from "joi";

import { AdminService } from "application/services/admin/AdminService";
import { UserService } from "application/services/user/UserService";
import { ADMIN_PING_REDIS_SCAN_KEY } from "domain/constants/admin";
import { HttpStatus } from "domain/enums/HttpStatus";
import { Permissions } from "domain/enums/Permissions";
import {
  AdminDashboardData,
  AdminPingData,
  AdminSystemHealthData,
  AdminUserListData,
} from "domain/types/admin/AdminTypes";
import { UserPaginationOpts } from "domain/types/pagination/user/UserPaginationOpts";
import { ILogger } from "infrastructure/logger/ILogger";
import { RedisService } from "infrastructure/services/redis/RedisService";
import { asyncHandler } from "presentation/middleware/asyncHandlerMiddleware";
import { checkPermissionMiddleware } from "presentation/middleware/permission/PermissionMiddleware";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";
import { userPaginationScheme } from "presentation/schemes/user/userSchemes";

/**
 * Handles admin panel REST API endpoints
 */
export class AdminRestApiController {
  constructor(
    private readonly app: Express,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly logger: ILogger,
    private readonly adminService: AdminService
  ) {
    const router = Router();

    // API routes
    this.app.use("/v1/admin/api", router);

    // Admin dashboard overview
    router.get(
      "/dashboard",
      checkPermissionMiddleware(Permissions.ADMIN_PANEL_ACCESS, this.logger),
      asyncHandler(this.getDashboard)
    );

    // Enhanced user management for admin
    router.get(
      "/users",
      checkPermissionMiddleware(Permissions.VIEW_USERS_INFO, this.logger),
      asyncHandler(this.getUsers)
    );

    // System health check
    router.get(
      "/system/health",
      checkPermissionMiddleware(Permissions.VIEW_SYSTEM_HEALTH, this.logger),
      asyncHandler(this.getSystemHealth)
    );

    // User ban/unban actions
    router.post(
      "/users/:id/ban",
      checkPermissionMiddleware(Permissions.BAN_USERS, this.logger),
      asyncHandler(this.banUser)
    );

    router.post(
      "/users/:id/unban",
      checkPermissionMiddleware(Permissions.BAN_USERS, this.logger),
      asyncHandler(this.unbanUser)
    );

    // User mute/unmute actions
    router.post(
      "/users/:id/mute",
      checkPermissionMiddleware(Permissions.MUTE_PLAYER, this.logger),
      asyncHandler(this.muteUser)
    );

    router.post(
      "/users/:id/unmute",
      checkPermissionMiddleware(Permissions.MUTE_PLAYER, this.logger),
      asyncHandler(this.unmuteUser)
    );

    // Admin user restore
    router.post(
      "/users/restore/:id",
      checkPermissionMiddleware(Permissions.DELETE_ANOTHER_USER, this.logger),
      asyncHandler(this.restoreUser)
    );

    // Admin user deletion
    router.delete(
      "/users/:id",
      checkPermissionMiddleware(Permissions.DELETE_ANOTHER_USER, this.logger),
      asyncHandler(this.deleteUser)
    );

    // Ping endpoint
    router.get(
      "/system/ping",
      checkPermissionMiddleware(Permissions.VIEW_SYSTEM_HEALTH, this.logger),
      asyncHandler(this.ping)
    );
  }

  private getDashboard = async (req: Request, res: Response) => {
    this.logger.audit("Admin dashboard requested", {
      prefix: "[ADMIN]: ",
      userId: req.user?.id,
    });

    const log = this.logger.performance("Admin dashboard data fetch", {
      userId: req.user?.id,
    });

    try {
      const timeframeRaw = req.query.timeframe as string | undefined;
      const timeframeDays = timeframeRaw
        ? parseInt(timeframeRaw, 10)
        : undefined;
      const data: AdminDashboardData = await this.adminService.getDashboardData(
        { timeframeDays }
      );

      log.finish({
        totalUsers: data.totalUsers,
        redisKeys: data.systemHealth.redisKeys,
      });
      return res.status(HttpStatus.OK).json(data);
    } catch (error) {
      log.finish();
      this.logger.error("Failed to fetch admin dashboard data", {
        prefix: "[ADMIN]: ",
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      });
      throw error;
    }
  };

  private getUsers = async (req: Request, res: Response) => {
    this.logger.debug("Admin users list requested", {
      prefix: "[ADMIN]: ",
      userId: req.user?.id,
      query: req.query,
    });

    const log = this.logger.performance("Admin users list fetch", {
      userId: req.user?.id,
      query: req.query,
    });

    try {
      const paginationQuery = new RequestDataValidator<UserPaginationOpts>(
        req.query as unknown as UserPaginationOpts,
        userPaginationScheme()
      ).validate();

      const data: AdminUserListData =
        await this.adminService.listUsersWithStats(paginationQuery);

      log.finish({
        totalUsers: data.stats.total,
        returnedUsers: data.data.length,
      });
      return res.status(HttpStatus.OK).json(data);
    } catch (error) {
      log.finish();

      this.logger.error("Failed to fetch admin users list", {
        prefix: "[ADMIN]: ",
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      });
      throw error;
    }
  };

  private getSystemHealth = async (req: Request, res: Response) => {
    this.logger.audit("System health check requested", {
      prefix: "[ADMIN]: ",
      userId: req.user?.id,
    });

    const log = this.logger.performance("System health check", {
      userId: req.user?.id,
    });

    try {
      const data: AdminSystemHealthData =
        await this.adminService.getSystemHealth();

      log.finish({
        redisConnected: data.redis.connected,
        redisKeys: data.redis.keys,
        estimatedRedisMB: data.redis.estimatedMemoryMB,
      });
      return res.status(HttpStatus.OK).json(data);
    } catch (error) {
      log.finish();

      this.logger.error("Failed to fetch system health", {
        prefix: "[ADMIN]: ",
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
      });
      throw error;
    }
  };

  private banUser = async (req: Request, res: Response) => {
    const { userId } = new RequestDataValidator<{ userId: number }>(
      { userId: Number(req.params.id) },
      Joi.object({ userId: Joi.number().integer().min(0).required() })
    ).validate();

    this.logger.audit("Admin user ban initiated", {
      prefix: "[ADMIN]: ",
      targetUserId: userId,
      adminUserId: req.user?.id,
    });

    await this.userService.ban(userId);

    return res.status(HttpStatus.OK).json({
      userId,
      isBanned: true,
    });
  };

  private unbanUser = async (req: Request, res: Response) => {
    const { userId } = new RequestDataValidator<{ userId: number }>(
      { userId: Number(req.params.id) },
      Joi.object({ userId: Joi.number().integer().min(0).required() })
    ).validate();

    this.logger.audit("Admin user unban initiated", {
      prefix: "[ADMIN]: ",
      targetUserId: userId,
      adminUserId: req.user?.id,
    });

    await this.userService.unban(userId);

    return res.status(HttpStatus.OK).json({
      userId,
      isBanned: false,
    });
  };

  private muteUser = async (req: Request, res: Response) => {
    const { userId, mutedUntil } = new RequestDataValidator<{
      userId: number;
      mutedUntil: string;
    }>(
      { userId: Number(req.params.id), mutedUntil: req.body.mutedUntil },
      Joi.object({
        userId: Joi.number().integer().min(0).required(),
        mutedUntil: Joi.date().iso().required(),
      })
    ).validate();

    const mutedUntilDate = new Date(mutedUntil);

    this.logger.audit("Admin user mute initiated", {
      prefix: "[ADMIN]: ",
      targetUserId: userId,
      adminUserId: req.user?.id,
      mutedUntil: mutedUntilDate.toISOString(),
    });

    await this.userService.mute(userId, mutedUntilDate);

    return res.status(HttpStatus.OK).json({
      userId,
      mutedUntil: mutedUntilDate.toISOString(),
    });
  };

  private unmuteUser = async (req: Request, res: Response) => {
    const { userId } = new RequestDataValidator<{ userId: number }>(
      { userId: Number(req.params.id) },
      Joi.object({ userId: Joi.number().integer().min(0).required() })
    ).validate();

    this.logger.audit("Admin user unmute initiated", {
      prefix: "[ADMIN]: ",
      targetUserId: userId,
      adminUserId: req.user?.id,
    });

    await this.userService.unmute(userId);

    return res.status(HttpStatus.OK).json({
      userId,
      mutedUntil: null,
    });
  };

  private deleteUser = async (req: Request, res: Response) => {
    const { userId } = new RequestDataValidator<{ userId: number }>(
      { userId: Number(req.params.id) },
      Joi.object({ userId: Joi.number().integer().min(0).required() })
    ).validate();

    this.logger.audit("Admin user delete initiated", {
      prefix: "[ADMIN]: ",
      targetUserId: userId,
      adminUserId: req.user?.id,
    });

    await this.userService.delete(userId);

    return res.status(HttpStatus.NO_CONTENT).send();
  };

  private restoreUser = async (req: Request, res: Response) => {
    const { userId } = new RequestDataValidator<{ userId: number }>(
      { userId: Number(req.params.id) },
      Joi.object({ userId: Joi.number().integer().min(0).required() })
    ).validate();

    this.logger.audit("Admin user restore initiated", {
      prefix: "[ADMIN]: ",
      targetUserId: userId,
      adminUserId: req.user?.id,
    });

    await this.userService.restore(userId);

    return res.status(HttpStatus.OK).json({ userId, restored: true });
  };

  private ping = async (_req: Request, res: Response) => {
    const start = process.hrtime.bigint();
    // Measure Event Loop delay (lag)
    await new Promise<void>((resolve) => setImmediate(resolve));
    const end = process.hrtime.bigint();

    const eventLoopLagMs = Number(end - start) / 1_000_000; // convert ns -> ms

    let redisOk = false;
    let redisResponseMs: number | null = null;

    const rStart = process.hrtime.bigint();
    try {
      await this.redisService.scan(ADMIN_PING_REDIS_SCAN_KEY);

      const rEnd = process.hrtime.bigint();
      redisResponseMs = Number(rEnd - rStart) / 1_000_000;
      redisOk = true;
    } catch {
      const rEnd = process.hrtime.bigint();
      redisResponseMs = Number(rEnd - rStart) / 1_000_000;
      redisOk = false;
    }

    const payload: AdminPingData = {
      ok: true,
      eventLoopLagMs: +eventLoopLagMs.toFixed(3),
      redis: {
        connected: redisOk,
        responseMs:
          redisResponseMs != null ? +redisResponseMs.toFixed(3) : null,
      },
      timestamp: new Date().toISOString(),
    };
    return res.status(HttpStatus.OK).json(payload);
  };
}

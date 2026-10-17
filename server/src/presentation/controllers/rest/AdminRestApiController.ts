import { type Express, type Request, type Response, Router } from "express";

import { AdminDiagnosticsService } from "application/services/admin/AdminDiagnosticsService";
import { AdminGameService } from "application/services/admin/AdminGameService";
import { AdminService } from "application/services/admin/AdminService";
import { UserService } from "application/services/user/UserService";
import { HttpStatus } from "domain/enums/HttpStatus";
import { Permissions } from "domain/enums/Permissions";
import {
  type AdminDashboardData,
  type AdminGameListQuery,
  type AdminSystemHealthData,
  type AdminUserListData
} from "domain/types/admin/AdminTypes";
import { type UserPermissionsUpdateDTO } from "domain/types/dto/user/UserPermissionsUpdateDTO";
import { type UserMuteInputDTO } from "domain/types/dto/user/UserMuteInputDTO";
import { type UserMuteResponseDTO } from "domain/types/dto/user/UserMuteResponseDTO";
import { type UserUnmuteInputDTO } from "domain/types/dto/user/UserUnmuteInputDTO";
import { asUserId, type userId } from "domain/types/ids";
import { type UserPaginationOpts } from "domain/types/pagination/user/UserPaginationOpts";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { type LogFilter } from "shared/logging/LogReaderTypes";
import { LogTag } from "shared/logging/LogTag";
import { asyncHandler } from "presentation/middleware/asyncHandlerMiddleware";
import { checkPermissionMiddleware } from "presentation/middleware/permission/PermissionMiddleware";
import {
  adminGameListScheme,
  adminGamePlayerScheme,
  adminUserIdScheme
} from "presentation/schemes/admin/adminSchemes";
import { gameIdScheme } from "presentation/schemes/game/gameSchemes";
import { type LogQueryParams, logQueryParamsScheme } from "presentation/schemes/log/logSchemes";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";
import {
  userMuteScheme,
  userPaginationScheme,
  userPermissionsUpdateScheme,
  userUnmuteScheme
} from "presentation/schemes/user/userSchemes";

/**
 * Handles admin panel REST API endpoints
 */
export class AdminRestApiController {
  constructor(
    private readonly app: Express,
    private readonly userService: UserService,
    private readonly logger: ILogger,
    private readonly adminService: AdminService,
    private readonly adminDiagnosticsService: AdminDiagnosticsService,
    private readonly adminGameService: AdminGameService
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

    // System logs retrieval
    router.get(
      "/system/logs",
      checkPermissionMiddleware(Permissions.VIEW_SYSTEM_LOGS, this.logger),
      asyncHandler(this.getLogs)
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

    // Staff roles: permission list and presets, then per-user permissions
    router.get(
      "/roles",
      checkPermissionMiddleware(Permissions.ADMIN_PANEL_ACCESS, this.logger),
      asyncHandler(this.getRoles)
    );

    router.put(
      "/users/:id/permissions",
      checkPermissionMiddleware(Permissions.MANAGE_PERMISSIONS, this.logger),
      asyncHandler(this.setUserPermissions)
    );

    // Game moderation, live games included
    router.get(
      "/games",
      checkPermissionMiddleware(Permissions.MANAGE_GAMES, this.logger),
      asyncHandler(this.listGames)
    );

    router.get(
      "/games/:gameId",
      checkPermissionMiddleware(Permissions.MANAGE_GAMES, this.logger),
      asyncHandler(this.getGame)
    );

    router.post(
      "/games/:gameId/players/:playerId/kick",
      checkPermissionMiddleware(Permissions.MANAGE_GAMES, this.logger),
      asyncHandler(this.kickPlayer)
    );

    router.post(
      "/games/:gameId/pause",
      checkPermissionMiddleware(Permissions.MANAGE_GAMES, this.logger),
      asyncHandler(this.pauseGame)
    );

    router.post(
      "/games/:gameId/unpause",
      checkPermissionMiddleware(Permissions.MANAGE_GAMES, this.logger),
      asyncHandler(this.unpauseGame)
    );

    router.delete(
      "/games/:gameId",
      checkPermissionMiddleware(Permissions.MANAGE_GAMES, this.logger),
      asyncHandler(this.closeGame)
    );
  }

  /** Validated `:id` of the target user, after the self/staff guard. */
  private async moderatedUserId(req: Request): Promise<userId> {
    const { userId } = new RequestDataValidator<{ userId: number }>(
      { userId: Number(req.params.id) },
      adminUserIdScheme()
    ).validate();

    await this.adminService.assertCanModerateUser(req.session.userId, asUserId(userId));

    return asUserId(userId);
  }

  private validGameId(req: Request): string {
    return new RequestDataValidator<{ gameId: string }>(
      { gameId: req.params.gameId },
      gameIdScheme()
    ).validate().gameId;
  }

  private getRoles = async (_req: Request, res: Response) => {
    return res.status(HttpStatus.OK).json(this.adminService.getRoles());
  };

  private setUserPermissions = async (req: Request, res: Response) => {
    const { userId } = new RequestDataValidator<{ userId: number }>(
      { userId: Number(req.params.id) },
      adminUserIdScheme()
    ).validate();
    const { permissions } = new RequestDataValidator<UserPermissionsUpdateDTO>(
      req.body,
      userPermissionsUpdateScheme()
    ).validate();

    const user = await this.adminService.setUserPermissions(
      req.session.userId,
      asUserId(userId),
      permissions
    );

    return res.status(HttpStatus.OK).json(user);
  };

  private listGames = async (req: Request, res: Response) => {
    const query = new RequestDataValidator<AdminGameListQuery>(
      req.query as unknown as AdminGameListQuery,
      adminGameListScheme()
    ).validate();

    return res.status(HttpStatus.OK).json(await this.adminGameService.list(query));
  };

  private getGame = async (req: Request, res: Response) => {
    return res
      .status(HttpStatus.OK)
      .json(await this.adminGameService.details(this.validGameId(req)));
  };

  private kickPlayer = async (req: Request, res: Response) => {
    const { gameId, playerId } = new RequestDataValidator<{ gameId: string; playerId: number }>(
      { gameId: req.params.gameId, playerId: Number(req.params.playerId) },
      adminGamePlayerScheme()
    ).validate();

    await this.adminGameService.kick(req.session.userId!, gameId, playerId);

    return res.status(HttpStatus.NO_CONTENT).send();
  };

  private pauseGame = async (req: Request, res: Response) => {
    await this.adminGameService.setPaused(req.session.userId!, this.validGameId(req), true);

    return res.status(HttpStatus.NO_CONTENT).send();
  };

  private unpauseGame = async (req: Request, res: Response) => {
    await this.adminGameService.setPaused(req.session.userId!, this.validGameId(req), false);

    return res.status(HttpStatus.NO_CONTENT).send();
  };

  private closeGame = async (req: Request, res: Response) => {
    await this.adminGameService.close(req.session.userId!, this.validGameId(req));

    return res.status(HttpStatus.NO_CONTENT).send();
  };

  /**
   * Get admin dashboard data
   */
  private getDashboard = async (req: Request, res: Response) => {
    this.logger.audit("Admin dashboard accessed", {
      prefix: LogPrefix.ADMIN,
      adminUserId: req.auth?.userId
    });

    const log = this.logger.performance("Admin dashboard query", {
      prefix: LogPrefix.ADMIN,
      adminUserId: req.auth?.userId
    });

    const timeframeRaw = req.query.timeframe as string | undefined;
    const timeframeDays = timeframeRaw ? parseInt(timeframeRaw, 10) : undefined;
    const data: AdminDashboardData = await this.adminService.getDashboardData({
      timeframeDays
    });

    log.finish();
    return res.status(HttpStatus.OK).json(data);
  };

  /**
   * Get admin users list with pagination
   */
  private getUsers = async (req: Request, res: Response) => {
    const log = this.logger.performance("Admin users query", {
      prefix: LogPrefix.ADMIN,
      adminUserId: req.auth?.userId
    });

    const paginationQuery = new RequestDataValidator<UserPaginationOpts>(
      req.query as unknown as UserPaginationOpts,
      userPaginationScheme()
    ).validate();

    const data: AdminUserListData = await this.adminService.listUsersWithStats(paginationQuery);

    log.finish();
    return res.status(HttpStatus.OK).json(data);
  };

  /**
   * Get system health metrics
   */
  private getSystemHealth = async (req: Request, res: Response) => {
    this.logger.audit("System health check performed", {
      prefix: LogPrefix.ADMIN,
      adminUserId: req.auth?.userId
    });

    const log = this.logger.performance("System health query", {
      prefix: LogPrefix.ADMIN,
      adminUserId: req.auth?.userId
    });

    const data: AdminSystemHealthData = await this.adminService.getSystemHealth();

    log.finish();
    return res.status(HttpStatus.OK).json(data);
  };

  /**
   * Ban user - security action
   */
  private banUser = async (req: Request, res: Response) => {
    const userId = await this.moderatedUserId(req);

    await this.userService.ban(userId);

    this.logger.audit("User banned", {
      prefix: LogPrefix.ADMIN,
      targetUserId: userId,
      adminUserId: req.auth?.userId
    });

    return res.status(HttpStatus.OK).json({
      userId,
      isBanned: true
    });
  };

  /**
   * Unban user - security action
   */
  private unbanUser = async (req: Request, res: Response) => {
    const userId = await this.moderatedUserId(req);

    await this.userService.unban(userId);

    this.logger.audit("User unbanned", {
      prefix: LogPrefix.ADMIN,
      targetUserId: userId,
      adminUserId: req.auth?.userId
    });

    return res.status(HttpStatus.OK).json({
      userId,
      isBanned: false
    });
  };

  private muteUser = async (req: Request, res: Response) => {
    await this.moderatedUserId(req);

    const { userId, mutedUntil } = new RequestDataValidator<UserMuteInputDTO>(
      {
        userId: asUserId(Number(req.params.id)),
        mutedUntil: req.body.mutedUntil
      },
      userMuteScheme()
    ).validate();

    const mutedUntilDate = new Date(mutedUntil);

    await this.userService.mute(userId, mutedUntilDate);

    this.logger.audit("User muted", {
      prefix: LogPrefix.ADMIN,
      targetUserId: userId,
      adminUserId: req.auth?.userId,
      mutedUntil: mutedUntilDate.toISOString()
    });

    const response: UserMuteResponseDTO = {
      userId,
      mutedUntil: mutedUntilDate.toISOString()
    };

    return res.status(HttpStatus.OK).json(response);
  };

  private unmuteUser = async (req: Request, res: Response) => {
    await this.moderatedUserId(req);

    const { userId } = new RequestDataValidator<UserUnmuteInputDTO>(
      { userId: asUserId(Number(req.params.id)) },
      userUnmuteScheme()
    ).validate();

    await this.userService.unmute(userId);

    this.logger.audit("User unmuted", {
      prefix: LogPrefix.ADMIN,
      targetUserId: userId,
      adminUserId: req.auth?.userId
    });

    const response: UserMuteResponseDTO = {
      userId,
      mutedUntil: null
    };

    return res.status(HttpStatus.OK).json(response);
  };

  /**
   * Delete user - security action
   */
  private deleteUser = async (req: Request, res: Response) => {
    const userId = await this.moderatedUserId(req);

    await this.userService.delete(userId);

    this.logger.audit("User deleted", {
      prefix: LogPrefix.ADMIN,
      targetUserId: userId,
      adminUserId: req.auth?.userId
    });

    return res.status(HttpStatus.NO_CONTENT).send();
  };

  /**
   * Restore deleted user - security action
   */
  private restoreUser = async (req: Request, res: Response) => {
    const userId = await this.moderatedUserId(req);

    await this.userService.restore(userId);

    this.logger.audit("User restored", {
      prefix: LogPrefix.ADMIN,
      targetUserId: userId,
      adminUserId: req.auth?.userId
    });

    return res.status(HttpStatus.OK).json({ userId, restored: true });
  };

  private ping = async (_req: Request, res: Response) => {
    const payload = await this.adminDiagnosticsService.ping();
    return res.status(HttpStatus.OK).json(payload);
  };

  /**
   * Get system logs with filtering support.
   *
   * Query params validated via Joi schema (logQueryParamsScheme):
   * - levels: comma-separated log levels (e.g., "error,warn,info")
   * - tags: comma-separated tags (e.g., "game,socket")
   * - correlationId: filter by specific correlation ID (UUID v4)
   * - gameId: filter by game ID (4-char alphanumeric)
   * - userId: filter by user ID
   * - since: ISO timestamp for start of time range
   * - until: ISO timestamp for end of time range
   * - search: text search in message (max 100 chars)
   * - limit: max entries (default: 100, max: 1000)
   * - offset: pagination offset (default: 0)
   */
  private getLogs = async (req: Request, res: Response) => {
    this.logger.audit("System logs accessed", {
      prefix: LogPrefix.ADMIN,
      adminUserId: req.auth?.userId
    });

    // Validate query params via Joi
    const validated = new RequestDataValidator<LogQueryParams>(
      req.query as unknown as LogQueryParams,
      logQueryParamsScheme
    ).validate();

    // Build filter from validated params
    const filter: LogFilter = {
      levels: validated.levels as unknown as string[] | undefined,
      tags: validated.tags as unknown as LogTag[] | undefined,
      correlationId: validated.correlationId,
      gameId: validated.gameId,
      userId: validated.userId,
      since: validated.since,
      until: validated.until,
      search: validated.search,
      limit: validated.limit,
      offset: validated.offset
    };

    // Fetch logs using scan-based pagination
    const result = await this.adminDiagnosticsService.readLogs(filter);

    return res.status(HttpStatus.OK).json({
      logs: result.logs,
      pagination: {
        scanned: result.scanned,
        skipped: result.skipped,
        matched: result.logs.length
      }
    });
  };
}

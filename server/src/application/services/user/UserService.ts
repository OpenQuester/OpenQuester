import { inject, singleton } from "tsyringe";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { type RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { FileUsageService } from "application/services/file/FileUsageService";
import { GamePipelineService } from "application/services/pipeline/GamePipelineService";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { UserNotificationRoomService } from "application/services/socket/UserNotificationRoomService";
import { UserSessionService } from "application/services/user/UserSessionService";
import { RegisterUser } from "application/types/user/RegisterUser";
import { UpdateUserDTO } from "application/types/user/UpdateUserDTO";
import { USER_RELATIONS, USER_SELECT_FIELDS } from "domain/constants/user";
import { ClientResponse } from "domain/enums/ClientResponse";
import { GameActionType } from "domain/enums/GameActionType";
import { HttpStatus } from "domain/enums/HttpStatus";
import { Permissions } from "domain/enums/Permissions";
import { ClientError } from "domain/errors/ClientError";
import { type GameAction } from "domain/types/action/GameAction";
import { UsersStats } from "domain/types/admin/AdminTypes";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { userId } from "domain/types/ids";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { UserPaginationOpts } from "domain/types/pagination/user/UserPaginationOpts";
import { SelectOptions } from "domain/types/SelectOptions";
import { ValueUtils } from "domain/utils/ValueUtils";
import { Permission } from "infrastructure/database/models/Permission";
import { User } from "infrastructure/database/models/User";
import { UserRepository } from "infrastructure/database/repositories/UserRepository";
import { S3FileUrlBuilder } from "infrastructure/storage/S3FileUrlBuilder";
import { DI_TOKENS } from "shared/di/tokens";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

/**
 * Service for user management operations.
 */
@singleton()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly fileUsageService: FileUsageService,
    private readonly userNotificationRoomService: UserNotificationRoomService,
    private readonly userSessionService: UserSessionService,
    private readonly gamePipelineService: GamePipelineService,
    private readonly socketUserDataService: SocketUserDataService,
    private readonly actionExecutor: GameActionExecutor,
    private readonly fileUrlBuilder: S3FileUrlBuilder,
    @inject(DI_TOKENS.RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  // --- Endpoint related methods --- //
  /**
   * Get list of all available users in DB
   */
  public async list(paginationOpts: UserPaginationOpts): Promise<PaginatedResult<UserDTO[]>> {
    this.logger.debug("Users listing with pagination options: ", {
      prefix: LogPrefix.USER,
      paginationOpts
    });

    const log = this.logger.performance(`User listing`, {
      prefix: LogPrefix.USER,
      paginationOpts
    });

    const usersListPaginated = await this.userRepository.list(paginationOpts, {
      select: USER_SELECT_FIELDS,
      relations: USER_RELATIONS,
      relationSelects: {
        avatar: ["id", "filename"],
        permissions: ["id", "name"]
      }
    });

    const usersData: UserDTO[] = usersListPaginated.data.map((user) => this.toDTO(user));

    log.finish({ usersData });

    return { data: usersData, pageInfo: usersListPaginated.pageInfo };
  }

  public async listRecent(limit: number, selectOptions: SelectOptions<User>, since?: Date) {
    return this.userRepository.listRecent(limit, selectOptions, since);
  }

  /**
   * Retrieve one user
   */
  public async get(userId: userId, selectOptions?: SelectOptions<User>): Promise<UserDTO> {
    return this.toDTO(await this.getRaw(userId, selectOptions));
  }

  public toDTO(user: User): UserDTO {
    return user.toDTO(this.fileUrlBuilder);
  }

  public async getRaw(userId: userId, selectOptions?: SelectOptions<User>): Promise<User> {
    this.logger.debug("Retrieving user with options: ", {
      prefix: LogPrefix.USER,
      userId,
      selectOptions
    });

    const log = this.logger.performance(`User retrieval`, {
      prefix: LogPrefix.USER,
      userId,
      selectOptions
    });

    const user = await this.userRepository.get(userId, {
      select: selectOptions?.select ?? USER_SELECT_FIELDS,
      relations: selectOptions?.relations ?? USER_RELATIONS,
      relationSelects: selectOptions?.relationSelects ?? {
        avatar: ["id", "filename"],
        permissions: ["id", "name"]
      }
    });

    if (!user) {
      this.logger.trace(`User not found: ${userId}`, {
        prefix: LogPrefix.USER,
        userId
      });
      log.finish();

      throw new ClientError(ClientResponse.USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    log.finish({
      hasAvatar: !!user.avatar,
      permissionCount: user.permissions?.length || 0
    });

    return user;
  }

  public async getActiveMutedUntil(userId: userId): Promise<string | null> {
    const mutedUntil = await this.userRepository.getMutedUntilUncached(userId);

    return this.toActiveMutedUntil(mutedUntil);
  }

  public async isGloballyMuted(userId: userId): Promise<boolean> {
    return (await this.getActiveMutedUntil(userId)) !== null;
  }

  public async create(data: RegisterUser) {
    this.logger.trace("User creation started", {
      prefix: LogPrefix.USER,
      email: data.email,
      username: data.username
    });

    const log = this.logger.performance(`User creation`, {
      prefix: LogPrefix.USER,
      email: data.email,
      username: data.username
    });
    const user = await this.userRepository.create(data);

    log.finish();

    this.logger.audit("User created", {
      prefix: LogPrefix.USER,
      userId: user.id,
      email: data.email,
      username: data.username,
      isGuest: user.is_guest
    });

    return user;
  }

  public async getStats(): Promise<UsersStats> {
    return this.userRepository.getStats();
  }

  public async findActiveByDiscordId(
    discordId: string,
    selectOptions: SelectOptions<User>
  ): Promise<User | null> {
    return this.userRepository.findActiveByDiscordId(discordId, selectOptions);
  }

  public async findActiveByIdentity(
    input: { username: string; email: string; discordId: string },
    selectOptions: SelectOptions<User>
  ): Promise<User | null> {
    return this.userRepository.findActiveByIdentity(input, selectOptions);
  }

  /**
   * Update user by params id
   */
  public async update(user: User, updateUserData: UpdateUserDTO) {
    return this._performUpdate(user, updateUserData);
  }

  /**
   * Delete user by params id
   */
  public async delete(userId: userId) {
    const result = await this._performDelete(userId);
    await this._forceLeaveAllGames(userId);
    return result;
  }

  public async ban(userId: userId) {
    await this.userRepository.ban(userId);
    await this._forceLeaveAllGames(userId);
  }

  public async unban(userId: userId) {
    await this.userRepository.unban(userId);
  }

  public async mute(userId: userId, mutedUntil: Date) {
    await this.userRepository.mute(userId, mutedUntil);
    await this.syncGlobalMuteRuntimeState(userId, this.toActiveMutedUntil(mutedUntil));
  }

  public async unmute(userId: userId) {
    await this.userRepository.unmute(userId);
    await this.syncGlobalMuteRuntimeState(userId, null);
  }

  public async restore(userId: userId) {
    await this.userRepository.restore(userId);
  }

  // --- Public methods --- //

  public async getUserBySession(
    sessionUserId: number | undefined,
    selectOptions: SelectOptions<User>
  ): Promise<User> {
    return this.userSessionService.getUserBySession(sessionUserId, selectOptions);
  }

  public async hasPermission(input: {
    sessionUserId: number | undefined;
    permission: Permissions;
  }): Promise<boolean> {
    return this.userSessionService.hasPermission(input);
  }

  public async canManageTargetUser(input: {
    sessionUserId: number | undefined;
    targetUserId: number;
    permission: Permissions;
  }): Promise<boolean> {
    return this.userSessionService.canManageTargetUser(input);
  }

  /**
   * Update user permissions with full business logic validation
   */
  public async updateUserPermissionsByNames(
    userId: userId,
    permissionNames: string[]
  ): Promise<UserDTO> {
    this.logger.debug("User permissions update initiated", {
      prefix: LogPrefix.USER,
      userId,
      permissionsCount: permissionNames.length,
      permissionNames
    });

    // Get the target user with current permissions
    const user = await this.getRaw(userId, {
      select: USER_SELECT_FIELDS,
      relations: USER_RELATIONS,
      relationSelects: {
        avatar: ["id", "filename"],
        permissions: ["id", "name"]
      }
    });

    if (!user || user.is_deleted) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    // Get permission entities by names
    const newPermissions = await this.getPermissionsByNames(permissionNames);

    // Validate that all requested permissions exist
    const foundPermissionNames = newPermissions.map((p: Permission) => p.name);
    const missingPermissions = permissionNames.filter(
      (name) => !foundPermissionNames.includes(name)
    );

    if (missingPermissions.length > 0) {
      throw new ClientError(ClientResponse.INVALID_INPUT, HttpStatus.BAD_REQUEST);
    }

    // Store old permissions for audit logging
    const oldPermissionsCount = user.permissions?.length || 0;

    // Update user permissions (replace all)
    user.permissions = newPermissions;

    // Save the user with updated permissions
    await this.userRepository.update(user);

    this.logger.audit("User permissions updated", {
      prefix: LogPrefix.USER,
      userId,
      oldPermissionsCount,
      newPermissionsCount: newPermissions.length,
      newPermissions: newPermissions.map((p: Permission) => p.name)
    });

    return this.toDTO(user);
  }

  /**
   * Get permission entities by their names
   */
  public async getPermissionsByNames(permissionNames: string[]): Promise<Permission[]> {
    if (permissionNames.length === 0) {
      return [];
    }

    // Add a method to UserRepository to get permissions
    const permissions = await this.userRepository.getPermissionsByNames(permissionNames);

    this.logger.debug("Found permissions while permission change", {
      prefix: LogPrefix.USER,
      requestedCount: permissionNames.length,
      foundCount: permissions.length,
      foundNames: permissions.map((p: Permission) => p.name)
    });

    return permissions;
  }

  private async _forceLeaveAllGames(userId: number): Promise<void> {
    const socketId = await this.socketUserDataService.findSocketIdByUserId(userId);

    if (!socketId) return;

    const sessionAndGame = await this.gamePipelineService.fetchSessionAndGame(socketId);

    if (!sessionAndGame) {
      // User is connected but not in any game — just disconnect
      this.realtimeGateway.disconnectSocket(socketId);
      return;
    }

    const { game } = sessionAndGame;

    // Dispatch leave through the action executor for proper Redis locking
    // and unified leave logic (game state cleanup, broadcasts, stats)
    const action: GameAction = {
      id: ValueUtils.generateUUID(),
      type: GameActionType.LEAVE,
      gameId: game.id,
      playerId: userId,
      socketId: socketId,
      timestamp: new Date(),
      payload: {}
    };

    await this.actionExecutor.submitAction(action);

    // Force disconnect across all instances via Redis adapter
    this.realtimeGateway.disconnectSocket(socketId);
  }

  private toActiveMutedUntil(mutedUntil: Date | null): string | null {
    if (!mutedUntil) {
      return null;
    }

    const mutedUntilDate = new Date(mutedUntil);
    return mutedUntilDate.getTime() > Date.now() ? mutedUntilDate.toISOString() : null;
  }

  private async syncGlobalMuteRuntimeState(
    userId: userId,
    mutedUntil: string | null
  ): Promise<void> {
    if (mutedUntil) {
      await this.socketUserDataService.setUserMuteExpiration(userId, mutedUntil);
    } else {
      await this.socketUserDataService.clearUserMuteExpiration(userId);
    }

    const socketId = await this.socketUserDataService.findSocketIdByUserId(userId);
    if (!socketId) {
      return;
    }

    await this.socketUserDataService.update(socketId, { mutedUntil });
    this.realtimeGateway.updateSocketContext({ socketId, mutedUntil });
  }

  // --- Private methods --- //
  /**
   * User deletion logic
   */
  private async _performDelete(userId: userId) {
    this.logger.debug("User deletion started", {
      prefix: LogPrefix.USER,
      userId
    });

    const user = await this.userRepository.get(userId, {
      select: ["id", "is_deleted"],
      relations: []
    });

    if (!user || user.is_deleted) {
      this.logger.warn(`User deletion failed - ${user ? "already deleted" : "not found"}`, {
        prefix: LogPrefix.USER,
        userId
      });
      throw new ClientError(ClientResponse.USER_NOT_FOUND);
    }

    const log = this.logger.performance(`User deletion`, {
      prefix: LogPrefix.USER,
      userId
    });

    const result = await this.userRepository.delete(user);

    log.finish();

    this.logger.audit("User deleted", {
      prefix: LogPrefix.USER,
      userId
    });

    return result;
  }

  /**
   * User updating logic
   */
  private async _performUpdate(user: User, updateUserData: UpdateUserDTO): Promise<UserDTO> {
    this.logger.trace("User update started", {
      prefix: LogPrefix.USER,
      userId: user.id,
      updateFields: Object.keys(updateUserData)
    });

    const updateData = updateUserData;

    // Check username uniqueness if username is being changed
    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await this.userRepository.existsByUsername(updateData.username);

      if (existingUser) {
        throw new ClientError(ClientResponse.USER_ALREADY_EXISTS);
      }
    }

    user.username = updateData.username ?? user.username;
    user.name = updateData.name ?? user.name;

    const previousAvatar = user.avatar;

    user.avatar = updateData.avatar ?? user.avatar;

    if (updateData.birthday) {
      const date = new Date(updateData.birthday);
      if (!ValueUtils.isValidDate(date)) {
        throw new ClientError(ClientResponse.BAD_DATE_FORMAT);
      }
      user.birthday = date;
    }

    const log = this.logger.performance(`User update`, {
      prefix: LogPrefix.USER,
      userId: user.id,
      changedFields: Object.keys(updateUserData)
    });

    await this.userRepository.update(user);

    if (updateData.avatar && updateData.avatar.id != previousAvatar?.id) {
      await this.fileUsageService.writeUsage(updateData.avatar, user);
      if (previousAvatar) {
        await this.fileUsageService.deleteUsage(previousAvatar, user);
      }
    }

    const updatedUserDTO = this.toDTO(user);

    // Emit user change event if notification service is available
    await this.userNotificationRoomService.emitUserChange(updatedUserDTO);

    log.finish({
      avatarChanged: updateData.avatar && updateData.avatar.id != previousAvatar?.id
    });

    this.logger.audit("User updated", {
      prefix: LogPrefix.USER,
      userId: user.id,
      changedFieldsCount: Object.keys(updateUserData).length,
      updatedAt: user.updated_at
    });

    return updatedUserDTO;
  }
}

import { type Request } from "express";
import { Namespace } from "socket.io";
import { FindOptionsWhere } from "typeorm";

import { FileUsageService } from "application/services/file/FileUsageService";
import { IGameLobbyLeaver } from "application/services/socket/IGameLobbyLeaver";
import { UserNotificationRoomService } from "application/services/socket/UserNotificationRoomService";
import { USER_RELATIONS, USER_SELECT_FIELDS } from "domain/constants/user";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { UpdateUserDTO } from "domain/types/dto/user/UpdateUserDTO";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { UserPaginationOpts } from "domain/types/pagination/user/UserPaginationOpts";
import { SelectOptions } from "domain/types/SelectOptions";
import { RegisterUser } from "domain/types/user/RegisterUser";
import { Permission } from "infrastructure/database/models/Permission";
import { User } from "infrastructure/database/models/User";
import { UserRepository } from "infrastructure/database/repositories/UserRepository";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly fileUsageService: FileUsageService,
    private readonly userNotificationRoomService: UserNotificationRoomService,
    private readonly gameNamespace: Namespace,
    private readonly logger: ILogger
  ) {
    //
  }
  private _gameLobbyLeaver: IGameLobbyLeaver | null = null;

  public setGameLobbyLeaver(leaver: IGameLobbyLeaver): void {
    this._gameLobbyLeaver = leaver;
  }

  /**
   * Get list of all available users in DB
   */
  public async list(
    paginationOpts: UserPaginationOpts
  ): Promise<PaginatedResult<UserDTO[]>> {
    this.logger.debug("Users listing with pagination options: ", {
      prefix: LogPrefix.USER,
      paginationOpts,
    });

    const log = this.logger.performance(`User listing`, {
      prefix: LogPrefix.USER,
      paginationOpts,
    });

    const usersListPaginated = await this.userRepository.list(paginationOpts, {
      select: USER_SELECT_FIELDS,
      relations: USER_RELATIONS,
      relationSelects: {
        avatar: ["id", "filename"],
        permissions: ["id", "name"],
      },
    });

    const usersData: UserDTO[] = usersListPaginated.data.map((user) =>
      user.toDTO()
    );

    log.finish({ usersData });

    return { data: usersData, pageInfo: usersListPaginated.pageInfo };
  }

  public async listRecent(
    limit: number,
    selectOptions: SelectOptions<User>,
    since?: Date
  ) {
    return this.userRepository.listRecent(limit, selectOptions, since);
  }

  /**
   * Retrieve one user
   */
  public async get(
    userId: number,
    selectOptions?: SelectOptions<User>
  ): Promise<UserDTO> {
    return (await this.getRaw(userId, selectOptions)).toDTO();
  }

  public async getRaw(
    userId: number,
    selectOptions?: SelectOptions<User>
  ): Promise<User> {
    this.logger.debug("Retrieving user with options: ", {
      prefix: LogPrefix.USER,
      userId,
      selectOptions,
    });

    const log = this.logger.performance(`User retrieval`, {
      prefix: LogPrefix.USER,
      userId,
      selectOptions,
    });

    const user = await this.userRepository.get(userId, {
      select: selectOptions?.select ?? USER_SELECT_FIELDS,
      relations: selectOptions?.relations ?? USER_RELATIONS,
      relationSelects: selectOptions?.relationSelects ?? {
        avatar: ["id", "filename"],
        permissions: ["id", "name"],
      },
    });

    if (!user) {
      this.logger.trace(`User not found: ${userId}`, {
        prefix: LogPrefix.USER,
        userId,
      });
      log.finish();

      throw new ClientError(
        ClientResponse.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    log.finish({
      hasAvatar: !!user.avatar,
      permissionCount: user.permissions?.length || 0,
    });

    return user;
  }

  public async create(data: RegisterUser) {
    this.logger.trace("User creation started", {
      prefix: LogPrefix.USER,
      email: data.email,
      username: data.username,
    });

    const log = this.logger.performance(`User creation`, {
      prefix: LogPrefix.USER,
      email: data.email,
      username: data.username,
    });
    const user = await this.userRepository.create(data);

    log.finish();

    this.logger.audit("User created", {
      prefix: LogPrefix.USER,
      userId: user.id,
      email: data.email,
      username: data.username,
      isGuest: user.is_guest,
    });

    return user;
  }

  public async find(
    where: FindOptionsWhere<User>,
    selectOptions: SelectOptions<User>
  ) {
    return this.userRepository.find(where, selectOptions);
  }

  public async count(where: FindOptionsWhere<User>): Promise<number> {
    return this.userRepository.count(where);
  }

  /**
   * Same as `get` method, but with custom `where` condition and avoids cache
   */
  public async findOne(
    where: FindOptionsWhere<User>,
    selectOptions: SelectOptions<User>
  ) {
    return this.userRepository.findOne(where, selectOptions);
  }

  public findByIds(
    ids: number[],
    selectOptions: SelectOptions<User>
  ): Promise<User[]> {
    return this.userRepository.findByIds(ids, selectOptions);
  }

  /**
   * Update user by params id
   */
  public async update(user: User, updateUserData: UpdateUserDTO) {
    return this.performUpdate(user, updateUserData);
  }

  /**
   * Delete user by params id
   */
  public async delete(userId: number) {
    const result = await this.performDelete(userId);
    await this.forceLeaveAllGames(userId);
    return result;
  }

  public async ban(userId: number) {
    await this.userRepository.ban(userId);
    await this.forceLeaveAllGames(userId);
  }

  public async unban(userId: number) {
    await this.userRepository.unban(userId);
  }

  public async mute(userId: number, mutedUntil: Date) {
    await this.userRepository.mute(userId, mutedUntil);
  }

  public async unmute(userId: number) {
    await this.userRepository.unmute(userId);
  }

  public async restore(userId: number) {
    await this.userRepository.restore(userId);
  }

  private async forceLeaveAllGames(userId: number): Promise<void> {
    const userSockets = Array.from(this.gameNamespace.sockets.values()).filter(
      (s) => s.userId === userId
    );
    if (userSockets.length === 0) return;

    const processedGameIds = new Set<string>();
    for (const socket of userSockets) {
      if (!this._gameLobbyLeaver) {
        this.logger.warn("Game lobby leaver not set; skipping forced leave.", {
          prefix: LogPrefix.USER,
          userId,
        });
        return;
      }
      const leaveResult = await this._gameLobbyLeaver.leaveLobby(socket.id);
      if (leaveResult.emit && leaveResult.data) {
        const gameId = leaveResult.data.gameId;

        if (gameId && !processedGameIds.has(gameId)) {
          this.gameNamespace
            .to(gameId)
            .emit(SocketIOGameEvents.LEAVE, { user: userId });
          processedGameIds.add(gameId);
        }
      }
    }
  }

  /**
   * User deletion logic
   */
  private async performDelete(userId: number) {
    this.logger.debug("User deletion started", {
      prefix: LogPrefix.USER,
      userId,
    });

    const user = await this.userRepository.get(userId, {
      select: ["id", "is_deleted"],
      relations: [],
    });

    if (!user || user.is_deleted) {
      this.logger.warn(
        `User deletion failed - ${user ? "already deleted" : "not found"}`,
        {
          prefix: LogPrefix.USER,
          userId,
        }
      );
      throw new ClientError(ClientResponse.USER_NOT_FOUND);
    }

    const log = this.logger.performance(`User deletion`, {
      prefix: LogPrefix.USER,
      userId,
    });

    const result = await this.userRepository.delete(user);

    log.finish();

    this.logger.audit("User deleted", {
      prefix: LogPrefix.USER,
      userId,
    });

    return result;
  }

  /**
   * User updating logic
   */
  private async performUpdate(
    user: User,
    updateUserData: UpdateUserDTO
  ): Promise<UserDTO> {
    this.logger.trace("User update started", {
      prefix: LogPrefix.USER,
      userId: user.id,
      updateFields: Object.keys(updateUserData),
    });

    const updateData = updateUserData;

    // Check username uniqueness if username is being changed
    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await this.userRepository.findOne(
        { username: updateData.username },
        { select: ["id"], relations: [], relationSelects: {} }
      );

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
      changedFields: Object.keys(updateUserData),
    });

    await this.userRepository.update(user);

    if (updateData.avatar && updateData.avatar.id != previousAvatar?.id) {
      await this.fileUsageService.writeUsage(updateData.avatar, user);
      if (previousAvatar) {
        await this.fileUsageService.deleteUsage(previousAvatar, user);
      }
    }

    const updatedUserDTO = user.toDTO();

    // Emit user change event if notification service is available
    this.userNotificationRoomService.emitUserChange(updatedUserDTO);

    log.finish({
      avatarChanged:
        updateData.avatar && updateData.avatar.id != previousAvatar?.id,
    });

    this.logger.audit("User updated", {
      prefix: LogPrefix.USER,
      userId: user.id,
      changedFieldsCount: Object.keys(updateUserData).length,
      updatedAt: user.updated_at,
    });

    return updatedUserDTO;
  }

  public async getUserByRequest(
    req: Request,
    selectOptions: SelectOptions<User>
  ) {
    if (!req.session.userId) {
      throw new ClientError(
        ClientResponse.INVALID_SESSION,
        HttpStatus.UNAUTHORIZED
      );
    }

    if (req.user) {
      return req.user;
    }

    const id = ValueUtils.validateId(req.session.userId);
    return this.userRepository.get(id, selectOptions);
  }

  /**
   * Update user permissions with full business logic validation
   */
  public async updateUserPermissionsByNames(
    userId: number,
    permissionNames: string[]
  ): Promise<UserDTO> {
    this.logger.debug("User permissions update initiated", {
      prefix: LogPrefix.USER,
      userId,
      permissionsCount: permissionNames.length,
      permissionNames,
    });

    // Get the target user with current permissions
    const user = await this.getRaw(userId, {
      select: USER_SELECT_FIELDS,
      relations: USER_RELATIONS,
      relationSelects: {
        avatar: ["id", "filename"],
        permissions: ["id", "name"],
      },
    });

    if (!user || user.is_deleted) {
      throw new ClientError(
        ClientResponse.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    // Get permission entities by names
    const newPermissions = await this.getPermissionsByNames(permissionNames);

    // Validate that all requested permissions exist
    const foundPermissionNames = newPermissions.map((p: Permission) => p.name);
    const missingPermissions = permissionNames.filter(
      (name) => !foundPermissionNames.includes(name)
    );

    if (missingPermissions.length > 0) {
      throw new ClientError(
        ClientResponse.INVALID_INPUT,
        HttpStatus.BAD_REQUEST
      );
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
      newPermissions: newPermissions.map((p: Permission) => p.name),
    });

    return user.toDTO();
  }

  /**
   * Get permission entities by their names
   */
  public async getPermissionsByNames(
    permissionNames: string[]
  ): Promise<Permission[]> {
    if (permissionNames.length === 0) {
      return [];
    }

    // Add a method to UserRepository to get permissions
    const permissions = await this.userRepository.getPermissionsByNames(
      permissionNames
    );

    this.logger.debug("Found permissions while permission change", {
      prefix: LogPrefix.USER,
      requestedCount: permissionNames.length,
      foundCount: permissions.length,
      foundNames: permissions.map((p: Permission) => p.name),
    });

    return permissions;
  }
}

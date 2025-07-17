import { type Request } from "express";
import { FindOptionsWhere } from "typeorm";

import { FileUsageService } from "application/services/file/FileUsageService";
import { UserNotificationRoomService } from "application/services/socket/UserNotificationRoomService";
import { USER_RELATIONS, USER_SELECT_FIELDS } from "domain/constants/user";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { UpdateUserDTO } from "domain/types/dto/user/UpdateUserDTO";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { PaginationOptsBase } from "domain/types/pagination/PaginationOpts";
import { SelectOptions } from "domain/types/SelectOptions";
import { RegisterUser } from "domain/types/user/RegisterUser";
import { User } from "infrastructure/database/models/User";
import { UserRepository } from "infrastructure/database/repositories/UserRepository";
import { ILogger } from "infrastructure/logger/ILogger";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly fileUsageService: FileUsageService,
    private readonly userNotificationRoomService: UserNotificationRoomService,
    private readonly logger: ILogger
  ) {
    //
  }
  /**
   * Get list of all available users in DB
   */
  public async list(
    paginationOpts: PaginationOptsBase<User>
  ): Promise<PaginatedResult<UserDTO[]>> {
    this.logger.trace("User listing started", {
      paginationOpts,
    });

    this.logger.debug("Users listing with pagination options: ", {
      paginationOpts,
    });

    const log = this.logger.performance(`User listing`, {
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
    this.logger.trace("User retrieval started", {
      userId,
      selectOptions,
    });

    this.logger.debug("Retrieving user with options: ", {
      userId,
      selectOptions,
    });

    const log = this.logger.performance(`User retrieval`, {
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
        userId,
      });
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
      email: data.email,
      username: data.username,
    });

    const log = this.logger.performance(`User creation`, {
      email: data.email,
      username: data.username,
    });
    const user = await this.userRepository.create(data);

    log.finish();

    this.logger.audit(`New user created: ${user.email}`, {
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    return user;
  }

  public async find(
    where: FindOptionsWhere<User>,
    selectOptions: SelectOptions<User>
  ) {
    return this.userRepository.find(where, selectOptions);
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
    return this.performDelete(userId);
  }

  /**
   * User deletion logic
   */
  private async performDelete(userId: number) {
    this.logger.trace("User deletion started", {
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
          userId,
        }
      );
      throw new ClientError(ClientResponse.USER_NOT_FOUND);
    }

    const log = this.logger.performance(`User deletion`, {
      userId,
    });

    const result = await this.userRepository.delete(user);

    log.finish();

    this.logger.audit(`User deleted: ${userId}`, {
      userId,
      deletedAt: new Date(),
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
      userId: user.id,
      updateFields: Object.keys(updateUserData),
    });

    const updateData = updateUserData;

    user.username = updateData.username ?? user.username;

    const previousAvatar = user.avatar;

    user.avatar = updateData.avatar ?? user.avatar;
    user.updated_at = new Date();

    if (updateData.birthday) {
      const date = new Date(updateData.birthday);
      if (!ValueUtils.isValidDate(date)) {
        throw new ClientError(ClientResponse.BAD_DATE_FORMAT);
      }
      user.birthday = date;
    }

    const log = this.logger.performance(`User update`, {
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

    this.logger.audit(`User updated: ${user.id}`, {
      userId: user.id,
      changedFields: Object.keys(updateUserData),
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
}

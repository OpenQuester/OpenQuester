import { singleton } from "tsyringe";

import { USER_RELATIONS, USER_SELECT_FIELDS } from "domain/constants/user";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { Permissions } from "domain/enums/Permissions";
import { ClientError } from "domain/errors/ClientError";
import { asUserId } from "domain/types/ids";
import { type SelectOptions } from "domain/types/SelectOptions";
import { ValueUtils } from "domain/utils/ValueUtils";
import { type User } from "infrastructure/database/models/User";
import { UserRepository } from "infrastructure/database/repositories/UserRepository";

/**
 * Handles session-user lookup and authorization checks shared by application services.
 */
@singleton()
export class UserSessionService {
  constructor(private readonly userRepository: UserRepository) {
    //
  }

  /**
   * Resolve a session user and fail when the session does not reference an existing user.
   */
  public async getUserBySession(
    sessionUserId: number | undefined,
    selectOptions: SelectOptions<User>
  ): Promise<User> {
    if (!sessionUserId) {
      throw new ClientError(ClientResponse.INVALID_SESSION, HttpStatus.UNAUTHORIZED);
    }

    const id = ValueUtils.validateId(sessionUserId);
    const user = await this.userRepository.get(asUserId(id), selectOptions);
    if (!user) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    return user;
  }

  /**
   * Resolve an active, non-banned session user with the default user projection.
   */
  public async getValidatedSessionUser(input: {
    sessionUserId: number | undefined;
  }): Promise<User> {
    const user = await this.getUserBySession(input.sessionUserId, {
      select: USER_SELECT_FIELDS,
      relations: USER_RELATIONS,
      relationSelects: {
        avatar: ["id", "filename"],
        permissions: ["id", "name"]
      }
    });

    if (user.is_deleted || user.is_banned) {
      throw new ClientError(ClientResponse.ACCESS_DENIED, HttpStatus.UNAUTHORIZED);
    }

    return user;
  }

  /**
   * Check whether a validated session user has a permission.
   */
  public async hasPermission(input: {
    sessionUserId: number | undefined;
    permission: Permissions;
  }): Promise<boolean> {
    const user = await this.getValidatedSessionUser({
      sessionUserId: input.sessionUserId
    });

    return this.userHasPermission(user, input.permission);
  }

  /**
   * Check whether a validated session user can manage another user.
   */
  public async canManageTargetUser(input: {
    sessionUserId: number | undefined;
    targetUserId: number;
    permission: Permissions;
  }): Promise<boolean> {
    const requestUser = await this.getValidatedSessionUser({
      sessionUserId: input.sessionUserId
    });

    return (
      requestUser.id === input.targetUserId || this.userHasPermission(requestUser, input.permission)
    );
  }

  /**
   * Check a permission on an already-loaded user entity.
   */
  public userHasPermission(user: User, permission: Permissions): boolean {
    const userPermissions = user.permissions?.map((value) => value.name) ?? [];
    return userPermissions.includes(permission);
  }
}

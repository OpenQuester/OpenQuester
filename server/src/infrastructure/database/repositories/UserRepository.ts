import { FindOptionsWhere, In, type Repository } from "typeorm";

import { FileUsageService } from "application/services/file/FileUsageService";
import { UserCacheUseCase } from "application/usecases/user/UserCacheUseCase";
import { ClientResponse } from "domain/enums/ClientResponse";
import { UserStatus } from "domain/enums/user/UserStatus";
import { UserType } from "domain/enums/user/UserType";
import { ClientError } from "domain/errors/ClientError";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";
import { UserPaginationOpts } from "domain/types/pagination/user/UserPaginationOpts";
import { SelectOptions } from "domain/types/SelectOptions";
import { RegisterUser } from "domain/types/user/RegisterUser";
import { Permission } from "infrastructure/database/models/Permission";
import { User } from "infrastructure/database/models/User";
import { QueryBuilder } from "infrastructure/database/QueryBuilder";
import { ILogger } from "infrastructure/logger/ILogger";
import { LOG_PREFIX } from "infrastructure/logger/LogPrefix";

export class UserRepository {
  constructor(
    private readonly repository: Repository<User>,
    private readonly fileUsageService: FileUsageService,
    private readonly cache: UserCacheUseCase,
    private readonly logger: ILogger
  ) {
    //
  }

  public async get(
    id: number,
    selectOptions: SelectOptions<User>,
    opts?: { searchDeleted: boolean }
  ): Promise<User | null> {
    // Try cache first
    const cached = await this.cache.get(id, selectOptions);
    if (cached) {
      this.logger.trace(`User ${id} cache hit`, {
        prefix: LOG_PREFIX.USER,
      });
      const user = new User();
      user.import(cached);
      return user;
    }

    const qb = await QueryBuilder.buildFindQuery<User>(
      this.repository,
      { id, is_deleted: opts ? opts.searchDeleted : false },
      selectOptions
    );

    const user = await qb.getOne();
    if (user) {
      await this.cache.set(user, selectOptions);
    }
    return user;
  }

  public async find(
    where: FindOptionsWhere<User>,
    selectOptions: SelectOptions<User>
  ) {
    const qb = await QueryBuilder.buildFindQuery<User>(
      this.repository,
      where,
      selectOptions
    );
    return qb.getMany();
  }

  public async count(where: FindOptionsWhere<User>): Promise<number> {
    return this.repository.count({ where });
  }

  public async findOne(
    where: FindOptionsWhere<User>,
    selectOptions: SelectOptions<User>
  ) {
    this.logger.trace("findOne for user with options: ", {
      where,
      selectOptions,
      prefix: LOG_PREFIX.USER,
    });

    const qb = await QueryBuilder.buildFindQuery<User>(
      this.repository,
      where,
      selectOptions
    );
    return qb.getOne();
  }

  public findByIds(
    ids: number[],
    selectOptions: SelectOptions<User>
  ): Promise<User[]> {
    return this.repository.find({
      where: { id: In(ids) },
      select: selectOptions.select,
      relations: selectOptions.relations,
    });
  }

  public async list(
    paginationOpts: UserPaginationOpts,
    selectOptions: SelectOptions<User>
  ) {
    const alias = this.repository.metadata.name.toLowerCase();

    const {
      order = PaginationOrder.ASC,
      sortBy = "created_at",
      limit,
      offset,
      search,
      status,
      userType,
    } = paginationOpts;

    const qbBase = this.repository.createQueryBuilder(alias);

    if (search) {
      qbBase.andWhere(
        `(LOWER(${alias}.username) LIKE :search OR LOWER(${alias}.email) LIKE :search)`,
        { search: `%${search.toLowerCase()}%` }
      );
    }

    if (status === UserStatus.BANNED) {
      qbBase.andWhere(`${alias}.is_banned = :banned`, { banned: true });
    } else if (status === UserStatus.ACTIVE) {
      qbBase.andWhere(`${alias}.is_banned = :banned`, { banned: false });
      qbBase.andWhere(`${alias}.is_deleted = :deleted`, { deleted: false });
    } else if (status === UserStatus.DELETED) {
      qbBase.andWhere(`${alias}.is_deleted = :deleted`, { deleted: true });
    }

    if (userType === UserType.GUEST) {
      qbBase.andWhere(`${alias}.is_guest = :isGuest`, { isGuest: true });
    } else if (userType === UserType.REGISTERED) {
      qbBase.andWhere(`${alias}.is_guest = :isGuest`, { isGuest: false });
    }
    // UserType.ALL doesn't need any additional filtering

    const [idRows, total] = await qbBase
      .select([`${alias}.id`, `${alias}.${String(sortBy)}`])
      .orderBy(
        `${alias}.${String(sortBy)}`,
        order.toUpperCase() as "ASC" | "DESC"
      )
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const ids = idRows.map((u) => u.id);

    if (ids.length === 0) {
      return {
        data: [],
        pageInfo: {
          total,
          limit,
          offset,
          hasNext: false,
          hasPrev: offset > 0,
        },
      };
    }

    let qb = this.repository
      .createQueryBuilder(alias)
      .select(selectOptions.select.map((field) => `${alias}.${field}`))
      .whereInIds(ids);

    qb = await QueryBuilder.buildRelationsSelect(
      qb,
      selectOptions.relations,
      selectOptions.relationSelects
    );

    qb.orderBy(
      `${alias}.${String(sortBy)}`,
      order.toUpperCase() as "ASC" | "DESC"
    );

    const users = await qb.getMany();

    const usersByIdSet = new Set(ids);
    const orderedUsers = users
      .filter((u) => usersByIdSet.has(u.id))
      .sort((a, b) => {
        if (a.id === b.id) return 0;
        if (order === PaginationOrder.ASC) {
          return a[sortBy]! < b[sortBy]! ? -1 : 1;
        } else {
          return a[sortBy]! > b[sortBy]! ? -1 : 1;
        }
      });

    const pageInfo = {
      total,
      limit,
      offset,
      hasNext: offset + limit < total,
      hasPrev: offset > 0,
    };

    return { data: orderedUsers, pageInfo };
  }

  public async listRecent(
    limit: number,
    selectOptions: SelectOptions<User>,
    since?: Date
  ): Promise<User[]> {
    const alias = this.repository.metadata.name.toLowerCase();

    let qb = this.repository
      .createQueryBuilder(alias)
      .select(selectOptions.select.map((f) => `${alias}.${f}`))
      .orderBy(`${alias}.created_at`, "DESC")
      .limit(limit);

    if (since) {
      qb = qb.where(`${alias}.created_at >= :since`, { since });
    }

    qb = await QueryBuilder.buildRelationsSelect(
      qb,
      selectOptions.relations,
      selectOptions.relationSelects
    );

    return qb.getMany();
  }

  public async create(data: RegisterUser) {
    // If this is a guest user, generate unique username
    let username = data.username;
    if (data.is_guest) {
      username = await this.generateGuestUsername();
    }

    const whereOpts: FindOptionsWhere<User>[] = [{ username: username }];

    if (data.email) {
      whereOpts.push({ email: data.email });
    }

    if (data.discord_id) {
      whereOpts.push({ discord_id: data.discord_id });
    }

    const existing = await this.repository.findOne({
      select: ["id"],
      where: whereOpts,
    });

    if (existing && existing.id >= 0) {
      throw new ClientError(ClientResponse.USER_ALREADY_EXISTS);
    }

    // Set all data to new user instance
    let user = new User();
    user.import({
      username: username,
      name: data.is_guest ? data.username : null, // Store original name for guests
      email: data.email,
      discord_id: data.discord_id,
      birthday: data.birthday ? new Date(data.birthday) : undefined,
      avatar: data.avatar,
      permissions: [],
      created_at: new Date(),
      updated_at: new Date(),
      is_deleted: false,
      is_banned: false,
      is_guest: data.is_guest ?? false,
    });

    // Save new user
    user = await this.save(user);
    if (data.avatar) {
      await this.fileUsageService.writeUsage(data.avatar, user);
    }
    return user;
  }

  /**
   * Generates the next available guest username in format guest_001, guest_002, etc.
   */
  private async generateGuestUsername(): Promise<string> {
    const result = await this.repository
      .createQueryBuilder("user")
      .select("user.username")
      .where("user.username LIKE :pattern", { pattern: "guest_%" })
      .orderBy("LENGTH(user.username)", "DESC")
      .addOrderBy("user.username", "DESC")
      .limit(1)
      .getOne();

    let nextNumber = 1;
    if (result) {
      const match = result.username.match(/guest_(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Pad with leading zeros only if number is less than 1000
    const paddedNumber =
      nextNumber < 1000
        ? nextNumber.toString().padStart(3, "0")
        : nextNumber.toString();

    return `guest_${paddedNumber}`;
  }

  public async delete(user: User) {
    user.is_deleted = true;
    const updateResult = await this.update(user);

    this.logger.audit(`User '${user.id} | ${user.email}' is deleted`, {
      prefix: LOG_PREFIX.USER,
    });

    return updateResult;
  }

  public async ban(userId: number) {
    const user = await this.get(userId, {
      select: ["id", "email", "updated_at", "is_banned"],
      relations: [],
    });

    if (!user) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND, 404);
    }

    user.is_banned = true;
    await this.update(user);

    this.logger.audit(`User '${user.id} | ${user.email}' is banned`, {
      prefix: LOG_PREFIX.USER,
    });
  }

  public async unban(userId: number) {
    const user = await this.get(userId, {
      select: ["id", "email", "updated_at", "is_banned"],
      relations: [],
    });

    if (!user) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND, 404);
    }

    if (!user.is_banned) {
      return;
    }

    user.is_banned = false;
    await this.update(user);

    this.logger.audit(`User '${user.id} | ${user.email}' is unbanned`, {
      prefix: LOG_PREFIX.USER,
    });
  }

  public async mute(userId: number, mutedUntil: Date) {
    const user = await this.get(userId, {
      select: ["id", "email", "updated_at", "muted_until"],
      relations: [],
    });

    if (!user) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND, 404);
    }

    user.muted_until = mutedUntil;
    await this.update(user);

    this.logger.audit(
      `User '${user.id} | ${
        user.email
      }' is muted until ${mutedUntil.toISOString()}`,
      {
        prefix: LOG_PREFIX.USER,
      }
    );
  }

  public async unmute(userId: number) {
    const user = await this.get(userId, {
      select: ["id", "email", "updated_at", "muted_until"],
      relations: [],
    });

    if (!user) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND, 404);
    }

    if (!user.muted_until) {
      return;
    }

    user.muted_until = null;
    await this.update(user);

    this.logger.audit(`User '${user.id} | ${user.email}' is unmuted`, {
      prefix: LOG_PREFIX.USER,
    });
  }

  /**
   * Updates user entity fields, sets updated_at and clears cache
   *
   * Use this method if existing user modified. If creating - use `.save()`
   */
  public async update(user: User) {
    user.updated_at = new Date();
    await this.cache.delete(user.id);
    const updateResult = await this.repository.update(
      { id: user.id },
      {
        username: user.username,
        name: user.name,
        email: user.email,
        birthday: user.birthday ?? null,
        avatar: user.avatar ?? null,
        is_deleted: user.is_deleted,
        is_banned: user.is_banned,
        muted_until: user.muted_until ?? null,
        updated_at: user.updated_at,
      }
    );

    this.logger.audit(`User '${user.id} | ${user.email}' is updated`, {
      prefix: LOG_PREFIX.USER,
    });

    return updateResult;
  }

  public async restore(userId: number) {
    const user = await this.get(
      userId,
      {
        select: ["id", "is_deleted", "email", "updated_at"],
        relations: [],
      },
      { searchDeleted: true }
    );

    if (!user) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND, 404);
    }

    if (!user.is_deleted) {
      return;
    }

    user.is_deleted = false;
    await this.update(user);

    this.logger.audit(`User '${user.id} | ${user.email}' is restored`, {
      prefix: LOG_PREFIX.USER,
    });
  }

  /**
   * Get permission entities by their names
   */
  public async getPermissionsByNames(
    permissionNames: string[]
  ): Promise<Permission[]> {
    const permissionRepository =
      this.repository.manager.getRepository(Permission);

    const permissions = await permissionRepository
      .createQueryBuilder("permission")
      .where("permission.name IN (:...names)", { names: permissionNames })
      .getMany();

    return permissions;
  }

  /**
   * Save updated user entity via repository, sets updated_at to current date and clears cache
   */
  public async save(user: User): Promise<User> {
    user.updated_at = new Date();
    await this.cache.delete(user.id);
    return this.repository.save(user);
  }
}

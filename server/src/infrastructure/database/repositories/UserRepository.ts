import { FindOptionsWhere, In, type Repository } from "typeorm";

import { FileUsageService } from "application/services/file/FileUsageService";
import { UserCacheUseCase } from "application/usecases/user/UserCacheUseCase";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";
import { UserPaginationOpts } from "domain/types/pagination/user/UserPaginationOpts";
import { SelectOptions } from "domain/types/SelectOptions";
import { RegisterUser } from "domain/types/user/RegisterUser";
import { User } from "infrastructure/database/models/User";
import { QueryBuilder } from "infrastructure/database/QueryBuilder";
import { ILogger } from "infrastructure/logger/ILogger";

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
        prefix: "[USER_REPOSITORY]: ",
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
      prefix: "[USER_REPOSITORY]: ",
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
    } = paginationOpts;

    const qbBase = this.repository.createQueryBuilder(alias);

    if (search) {
      qbBase.andWhere(
        `(LOWER(${alias}.username) LIKE :search OR LOWER(${alias}.email) LIKE :search)`,
        { search: `%${search.toLowerCase()}%` }
      );
    }

    if (status === "banned") {
      qbBase.andWhere(`${alias}.is_banned = :banned`, { banned: true });
    } else if (status === "active") {
      qbBase.andWhere(`${alias}.is_banned = :banned`, { banned: false });
      qbBase.andWhere(`${alias}.is_deleted = :deleted`, { deleted: false });
    } else if (status === "deleted") {
      qbBase.andWhere(`${alias}.is_deleted = :deleted`, { deleted: true });
    }

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
    const whereOpts: FindOptionsWhere<User>[] = [{ username: data.username }];

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
      username: data.username,
      email: data.email,
      discord_id: data.discord_id,
      birthday: data.birthday ? new Date(data.birthday) : undefined,
      avatar: data.avatar,
      permissions: [],
      created_at: new Date(),
      updated_at: new Date(),
      is_deleted: false,
      is_banned: false,
    });

    // Save new user
    user = await this.repository.save(user);
    if (data.avatar) {
      await this.fileUsageService.writeUsage(data.avatar, user);
    }
    await this.cache.delete(user.id);
    return user;
  }

  public async delete(user: User) {
    user.is_deleted = true;
    user.updated_at = new Date();
    await this.cache.delete(user.id);
    const updateResult = await this.update(user);

    this.logger.audit(`User '${user.id} | ${user.email}' is deleted`, {
      prefix: "[USER_REPOSITORY]: ",
    });

    return updateResult;
  }

  public async ban(userId: number) {
    const user = await this.get(userId, {
      select: ["id", "updated_at", "is_banned"],
      relations: [],
    });

    if (!user) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND, 404);
    }

    user.is_banned = true;
    user.updated_at = new Date();
    await this.cache.delete(user.id);
    await this.repository.save(user);

    this.logger.audit(`User '${user.id} | ${user.email}' is banned`, {
      prefix: "[USER_REPOSITORY]: ",
    });
  }

  public async unban(userId: number) {
    const user = await this.get(userId, {
      select: ["id", "updated_at", "is_banned"],
      relations: [],
    });

    if (!user) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND, 404);
    }

    if (!user.is_banned) {
      return;
    }

    user.is_banned = false;
    user.updated_at = new Date();
    await this.cache.delete(user.id);
    await this.repository.save(user);

    this.logger.audit(`User '${user.id} | ${user.email}' is unbanned`, {
      prefix: "[USER_REPOSITORY]: ",
    });
  }

  public async update(user: User) {
    this.logger.debug(`Updating user ${user.id}`, {
      prefix: "[USER_REPOSITORY]: ",
    });

    await this.cache.delete(user.id);
    const updateResult = await this.repository.update(
      { id: user.id },
      {
        username: user.username,
        email: user.email,
        birthday: user.birthday ?? null,
        avatar: user.avatar ?? null,
        is_deleted: user.is_deleted,
        is_banned: user.is_banned,
      }
    );

    this.logger.audit(`User '${user.id} | ${user.email}' is updated`, {
      prefix: "[USER_REPOSITORY]: ",
    });

    return updateResult;
  }

  public async restore(userId: number) {
    const user = await this.get(
      userId,
      {
        select: ["id", "is_deleted", "updated_at"],
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
    user.updated_at = new Date();
    await this.cache.delete(user.id);
    await this.repository.save(user);

    this.logger.audit(`User '${user.id} | ${user.email}' is restored`, {
      prefix: "[USER_REPOSITORY]: ",
    });
  }
}

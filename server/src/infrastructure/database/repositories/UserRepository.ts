import { FindOptionsWhere, In, type Repository } from "typeorm";

import { FileUsageService } from "application/services/file/FileUsageService";
import { UserCacheUseCase } from "application/usecases/user/UserCacheUseCase";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import {
  PaginationOptsBase,
  PaginationOrder,
} from "domain/types/pagination/PaginationOpts";
import { SelectOptions } from "domain/types/SelectOptions";
import { RegisterUser } from "domain/types/user/RegisterUser";
import { User } from "infrastructure/database/models/User";
import { PaginatedResults } from "infrastructure/database/pagination/PaginatedResults";
import { QueryBuilder } from "infrastructure/database/QueryBuilder";

export class UserRepository {
  constructor(
    private readonly repository: Repository<User>,
    private readonly fileUsageService: FileUsageService,
    private readonly cache: UserCacheUseCase
  ) {
    //
  }

  public async get(
    id: number,
    selectOptions: SelectOptions<User>
  ): Promise<User | null> {
    // Try cache first
    const cached = await this.cache.get(id, selectOptions);
    if (cached) {
      const user = new User();
      user.import(cached);
      return user;
    }

    const qb = await QueryBuilder.buildFindQuery<User>(
      this.repository,
      { id, is_deleted: false },
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

  public async findOne(
    where: FindOptionsWhere<User>,
    selectOptions: SelectOptions<User>
  ) {
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
    paginationOpts: PaginationOptsBase<User>,
    selectOptions: SelectOptions<User>
  ) {
    const alias = this.repository.metadata.name.toLowerCase();

    let qb = this.repository
      .createQueryBuilder(alias)
      .select(selectOptions.select.map((field) => `${alias}.${field}`));

    qb = await QueryBuilder.buildRelationsSelect(
      qb,
      selectOptions.relations,
      selectOptions.relationSelects
    );

    const { order = PaginationOrder.ASC, sortBy = "created_at" } =
      paginationOpts;

    qb.orderBy(
      `${qb.alias}.${String(sortBy)}`,
      order.toUpperCase() as "ASC" | "DESC"
    );

    return PaginatedResults.paginateEntityAndSelect<User>(qb, paginationOpts);
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
    return this.update(user);
  }

  public async update(user: User) {
    await this.cache.delete(user.id);
    return this.repository.update(
      { id: user.id },
      {
        username: user.username,
        email: user.email,
        birthday: user.birthday ?? null,
        avatar: user.avatar ?? null,
        is_deleted: user.is_deleted,
      }
    );
  }
}

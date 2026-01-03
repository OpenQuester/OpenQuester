import { type ObjectLiteral, type Repository } from "typeorm";

export async function deleteAll<T extends ObjectLiteral>(
  repo: Repository<T>
): Promise<void> {
  await repo.manager
    .createQueryBuilder()
    .delete()
    .from(repo.metadata.target)
    .execute();
}

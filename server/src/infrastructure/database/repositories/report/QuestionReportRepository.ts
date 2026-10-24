import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { Database } from "infrastructure/database/Database";
import { QuestionReport } from "infrastructure/database/models/report/QuestionReport";

@singleton()
export class QuestionReportRepository {
  constructor(@inject(DI_TOKENS.Database) private readonly db: Database) {
    //
  }

  private get repo() {
    return this.db.dataSource.getRepository(QuestionReport);
  }

  public async create(data: Partial<QuestionReport>): Promise<QuestionReport> {
    return this.repo.save(this.repo.create(data));
  }

  /** Open reports first, newest first within each group */
  public async listForPackage(packageId: number, limit: number): Promise<QuestionReport[]> {
    return this.repo.find({
      where: { package_id: packageId },
      relations: ["user"],
      order: { resolved: "ASC", created_at: "DESC" },
      take: limit
    });
  }

  public async countOpen(packageId: number): Promise<number> {
    return this.repo.count({ where: { package_id: packageId, resolved: false } });
  }

  public async hasOpenReport(
    userId: number,
    packageId: number,
    questionId: number
  ): Promise<boolean> {
    return this.repo.exists({
      where: { user_id: userId, package_id: packageId, question_id: questionId, resolved: false }
    });
  }

  public async findInPackage(packageId: number, reportId: number): Promise<QuestionReport | null> {
    return this.repo.findOne({
      where: { id: reportId, package_id: packageId },
      relations: ["user"]
    });
  }

  public async save(report: QuestionReport): Promise<QuestionReport> {
    return this.repo.save(report);
  }
}

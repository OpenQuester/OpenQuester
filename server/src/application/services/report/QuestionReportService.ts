import { singleton } from "tsyringe";

import { PackageService } from "application/services/package/PackageService";
import { UserSessionService } from "application/services/user/UserSessionService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import {
  QuestionReportDTO,
  QuestionReportInputDTO
} from "domain/types/dto/report/QuestionReportDTO";
import { QuestionReport } from "infrastructure/database/models/report/QuestionReport";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { QuestionReportRepository } from "infrastructure/database/repositories/report/QuestionReportRepository";

const REPORTS_LIST_LIMIT = 200;

/** Players flag wrong or broken questions; the package's author (or an editor) reads them. */
@singleton()
export class QuestionReportService {
  constructor(
    private readonly reportRepository: QuestionReportRepository,
    private readonly packageStore: PackageStore,
    private readonly packageService: PackageService,
    private readonly userSessionService: UserSessionService
  ) {
    //
  }

  /** Reports a question of the package a live game is playing. */
  public async reportFromGame(input: {
    sessionUserId: number | undefined;
    gameId: string;
    report: QuestionReportInputDTO;
  }): Promise<QuestionReportDTO> {
    const user = await this.userSessionService.getValidatedSessionUser({
      sessionUserId: input.sessionUserId
    });

    const meta = await this.packageStore.getMeta(input.gameId);
    if (!meta?.id) {
      throw new ClientError(ClientResponse.GAME_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    const question = await this.packageStore.getQuestion(input.gameId, input.report.questionId);
    if (!question) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    if (await this.reportRepository.hasOpenReport(user.id, meta.id, input.report.questionId)) {
      throw new ClientError(ClientResponse.QUESTION_REPORT_ALREADY_SENT, HttpStatus.CONFLICT);
    }

    const report = await this.reportRepository.create({
      package_id: meta.id,
      question_id: input.report.questionId,
      question_text: question.text ?? null,
      user_id: user.id,
      game_id: input.gameId,
      reason: input.report.reason,
      comment: input.report.comment?.trim() || null
    });

    report.user = user;

    return this.toDTO(report);
  }

  public async listForPackage(input: {
    sessionUserId: number | undefined;
    packageId: number;
  }): Promise<{ data: QuestionReportDTO[]; open: number }> {
    await this.packageService.assertCanEditPackage(input);
    const [reports, open] = await Promise.all([
      this.reportRepository.listForPackage(input.packageId, REPORTS_LIST_LIMIT),
      this.reportRepository.countOpen(input.packageId)
    ]);

    return { data: reports.map((r) => this.toDTO(r)), open };
  }

  public async setResolved(input: {
    sessionUserId: number | undefined;
    packageId: number;
    reportId: number;
    resolved: boolean;
  }): Promise<QuestionReportDTO> {
    await this.packageService.assertCanEditPackage(input);
    const report = await this.reportRepository.findInPackage(input.packageId, input.reportId);
    if (!report) {
      throw new ClientError(ClientResponse.QUESTION_REPORT_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    report.resolved = input.resolved;

    return this.toDTO(await this.reportRepository.save(report));
  }

  private toDTO(report: QuestionReport): QuestionReportDTO {
    return {
      id: report.id,
      packageId: report.package_id,
      questionId: report.question_id,
      questionText: report.question_text,
      reason: report.reason,
      comment: report.comment,
      resolved: report.resolved,
      reporter: report.user ? { id: report.user.id, username: report.user.username } : null,
      gameId: report.game_id,
      createdAt: report.created_at
    };
  }
}

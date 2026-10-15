import { type Express, type Request, type Response, Router } from "express";
import Joi from "joi";
import { container } from "tsyringe";

import { QuestionReportService } from "application/services/report/QuestionReportService";
import { UserStatsService } from "application/services/statistics/UserStatsService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { type QuestionReportInputDTO } from "domain/types/dto/report/QuestionReportDTO";
import { type LeaderboardPeriod } from "domain/types/dto/statistics/UserStatsDTO";
import { asyncHandler } from "presentation/middleware/asyncHandlerMiddleware";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";
import { gameIdScheme } from "presentation/schemes/game/gameSchemes";
import {
  leaderboardScheme,
  questionReportResolveScheme,
  questionReportScheme
} from "presentation/schemes/stats/statsSchemes";

const idScheme = () => Joi.object({ id: Joi.number().integer().min(1).required() });

/** Player stats, the leaderboard, and question reports sent to package authors */
export class StatsRestApiController {
  private readonly stats = container.resolve(UserStatsService);
  private readonly reports = container.resolve(QuestionReportService);

  constructor(private readonly app: Express) {
    const stats = Router();
    this.app.use("/v1/stats", stats);
    stats.get("/leaderboard", asyncHandler(this.getLeaderboard));
    stats.get("/me", asyncHandler(this.getMyStats));
    stats.get("/users/:id", asyncHandler(this.getUserStats));

    const games = Router();
    this.app.use("/v1/games", games);
    games.post("/:gameId/reports", asyncHandler(this.reportQuestion));

    const packages = Router();
    this.app.use("/v1/packages", packages);
    packages.get("/:id/reports", asyncHandler(this.listReports));
    packages.patch("/:id/reports/:reportId", asyncHandler(this.resolveReport));
  }

  private getLeaderboard = async (req: Request, res: Response) => {
    const { period, limit } = new RequestDataValidator<{
      period: LeaderboardPeriod;
      limit: number;
    }>(req.query as never, leaderboardScheme()).validate();
    res.status(HttpStatus.OK).send({ data: await this.stats.getLeaderboard(period, limit) });
  };

  private getMyStats = async (req: Request, res: Response) => {
    const userId = Number(req.session.userId);
    if (!userId) {
      throw new ClientError(ClientResponse.USER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    res.status(HttpStatus.OK).send(await this.stats.getUserStats(userId));
  };

  private getUserStats = async (req: Request, res: Response) => {
    const { id } = new RequestDataValidator<{ id: number }>(
      { id: Number(req.params.id) },
      idScheme()
    ).validate();
    res.status(HttpStatus.OK).send(await this.stats.getUserStats(id));
  };

  private reportQuestion = async (req: Request, res: Response) => {
    const { gameId } = new RequestDataValidator<{ gameId: string }>(
      { gameId: req.params.gameId },
      gameIdScheme()
    ).validate();
    const report = new RequestDataValidator<QuestionReportInputDTO>(
      req.body,
      questionReportScheme()
    ).validate();
    const data = await this.reports.reportFromGame({
      sessionUserId: req.session.userId,
      gameId,
      report
    });
    res.status(HttpStatus.OK).send(data);
  };

  private listReports = async (req: Request, res: Response) => {
    const { id } = new RequestDataValidator<{ id: number }>(
      { id: Number(req.params.id) },
      idScheme()
    ).validate();
    const data = await this.reports.listForPackage({
      sessionUserId: req.session.userId,
      packageId: id
    });
    res.status(HttpStatus.OK).send(data);
  };

  private resolveReport = async (req: Request, res: Response) => {
    const { id } = new RequestDataValidator<{ id: number }>(
      { id: Number(req.params.id) },
      idScheme()
    ).validate();
    const { id: reportId } = new RequestDataValidator<{ id: number }>(
      { id: Number(req.params.reportId) },
      idScheme()
    ).validate();
    const { resolved } = new RequestDataValidator<{ resolved: boolean }>(
      req.body,
      questionReportResolveScheme()
    ).validate();
    const data = await this.reports.setResolved({
      sessionUserId: req.session.userId,
      packageId: id,
      reportId,
      resolved
    });
    res.status(HttpStatus.OK).send(data);
  };
}

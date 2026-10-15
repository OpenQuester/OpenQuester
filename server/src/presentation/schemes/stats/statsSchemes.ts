import Joi from "joi";

import { QUESTION_REPORT_COMMENT_MAX_CHARS } from "domain/constants/report";
import {
  QuestionReportInputDTO,
  QuestionReportReason
} from "domain/types/dto/report/QuestionReportDTO";
import { LeaderboardPeriod } from "domain/types/dto/statistics/UserStatsDTO";

export const LEADERBOARD_LIMIT_MAX = 100;

export const leaderboardScheme = () =>
  Joi.object<{ period: LeaderboardPeriod; limit: number }>({
    period: Joi.valid(...Object.values(LeaderboardPeriod)).default(LeaderboardPeriod.ALL),
    limit: Joi.number().integer().min(1).max(LEADERBOARD_LIMIT_MAX).default(50)
  });

export const questionReportScheme = () =>
  Joi.object<QuestionReportInputDTO>({
    questionId: Joi.number().integer().min(1).required(),
    reason: Joi.valid(...Object.values(QuestionReportReason)).required(),
    comment: Joi.string().allow("", null).max(QUESTION_REPORT_COMMENT_MAX_CHARS).optional()
  });

export const questionReportResolveScheme = () =>
  Joi.object<{ resolved: boolean }>({ resolved: Joi.boolean().required() });

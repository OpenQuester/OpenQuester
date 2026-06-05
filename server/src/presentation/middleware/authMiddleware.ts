import { type NextFunction, type Request, type Response } from "express";
import Joi from "joi";
import { container } from "tsyringe";

import { TranslateService as ts } from "domain/utils/TranslateService";
import { UserService } from "application/services/user/UserService";
import { USER_RELATIONS, USER_SELECT_FIELDS } from "domain/constants/user";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ServerResponse } from "domain/enums/ServerResponse";
import { Session } from "domain/types/auth/session";
import { SessionDTO } from "domain/types/dto/auth/SessionDTO";
import { Environment, EnvType } from "shared/config/Environment";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { ValueUtils } from "domain/utils/ValueUtils";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";

const isPublicEndpoint = (env: Environment, url: string, method: string): boolean => {
  const publicEndpoints = ["v1/api-docs", "v1/users", "v1/files"];

  if (env.ENV === EnvType.DEV) {
    publicEndpoints.push("v1/dev");
  }

  const conditionalEndpoints = [
    { url: "v1/packages", method: "GET" },
    { url: "v1/games", method: "GET" },
    { url: "v1/auth/logout", method: "GET" },
    { url: "v1/auth/oauth2", method: "POST" },
    { url: "v1/auth/guest", method: "POST" }
  ];

  // Allow admin panel static files (but not API endpoints)
  const isAdminStaticFile = url.startsWith("/v1/admin") && !url.includes("/v1/admin/api/");

  return (
    isAdminStaticFile ||
    publicEndpoints.some((endpoint) => url.includes(endpoint)) ||
    conditionalEndpoints.some(
      (endpoint) => url.includes(endpoint.url) && method === endpoint.method
    )
  );
};

export const verifySession =
  (env: Environment, logger: ILogger) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (isPublicEndpoint(env, req.url, req.method)) {
      return next();
    }

    const dateExpired = new Date(String(req.session.cookie.expires)) < new Date();

    if (!req.session.userId || dateExpired || !ValueUtils.isNumeric(req.session.userId)) {
      return unauthorizedError(req, res);
    }

    const user = await container
      .resolve(UserService)
      .getUserBySession(req.session.userId, {
        select: USER_SELECT_FIELDS,
        relations: USER_RELATIONS,
        relationSelects: {
          avatar: ["id", "filename"],
          permissions: ["id", "name"]
        }
      });

    // Validate session with user data
    let validatedSession: SessionDTO;
    try {
      validatedSession = validateSession(req.session, user.is_guest);
    } catch (err: unknown) {
      return handleSessionValidationError(err, req, res, logger);
    }

    if (!validatedSession || !validatedSession.userId) {
      return unauthorizedError(req, res);
    }

    // Refresh session expire time
    req.session.touch();
    req.auth = {
      userId: user.id,
      isGuest: user.is_guest
    };

    next();
  };

function validateSession(session: Session, isGuest: boolean): SessionDTO {
  return new RequestDataValidator<SessionDTO>(
    {
      userId: session.userId,
      isGuest
    },
    Joi.object({
      userId: Joi.number().required(),
      isGuest: Joi.boolean().required()
    })
  ).validate();
}

async function handleSessionValidationError(
  err: unknown,
  req: Request,
  res: Response,
  logger: ILogger
) {
  if (err instanceof Error) {
    return unauthorizedError(req, res);
  }
  logger.error(`Unknown error during session validation: ${JSON.stringify(err)}`, {
    prefix: LogPrefix.AUTH
  });

  return res.send({ error: ServerResponse.INTERNAL_SERVER_ERROR }).status(HttpStatus.INTERNAL);
}

async function unauthorizedError(req: Request, res: Response) {
  return res.status(HttpStatus.UNAUTHORIZED).json({
    error: await ts.localize(ClientResponse.ACCESS_DENIED, req.headers["accept-language"])
  });
}

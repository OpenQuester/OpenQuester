import { type NextFunction, type Request, type Response } from "express";
import Joi from "joi";

import { Container, CONTAINER_TYPES } from "application/Container";
import { TranslateService as ts } from "application/services/text/TranslateService";
import { UserService } from "application/services/user/UserService";
import { USER_RELATIONS, USER_SELECT_FIELDS } from "domain/constants/user";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ServerResponse } from "domain/enums/ServerResponse";
import { Session } from "domain/types/auth/session";
import { SessionDTO } from "domain/types/dto/auth/SessionDTO";
import { Environment, EnvType } from "infrastructure/config/Environment";
import { ILogger } from "infrastructure/logger/ILogger";
import { ValueUtils } from "infrastructure/utils/ValueUtils";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";

const isPublicEndpoint = (
  env: Environment,
  url: string,
  method: string
): boolean => {
  const publicEndpoints = ["v1/api-docs", "v1/users", "v1/files"];

  if (env.ENV === EnvType.DEV) {
    publicEndpoints.push("v1/dev");
  }

  const conditionalEndpoints = [
    { url: "v1/packages", method: "GET" },
    { url: "v1/games", method: "GET" },
    { url: "v1/auth/logout", method: "GET" },
    { url: "v1/auth/oauth2", method: "POST" },
  ];

  return (
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

    const dateExpired =
      new Date(String(req.session.cookie.expires)) < new Date();

    if (
      !req.session.userId ||
      dateExpired ||
      !ValueUtils.isNumeric(req.session.userId)
    ) {
      return unauthorizedError(req, res);
    }

    let session: SessionDTO;
    try {
      session = validateSession(req.session);
    } catch (err: unknown) {
      return handleSessionValidationError(err, req, res, logger);
    }

    if (!session || !session.userId) {
      return unauthorizedError(req, res);
    }

    // TODO: Get from cache when implemented
    const user = await Container.get<UserService>(
      CONTAINER_TYPES.UserService
    ).getUserByRequest(req, {
      select: USER_SELECT_FIELDS,
      relations: USER_RELATIONS,
      relationSelects: {
        avatar: ["id", "filename"],
        permissions: ["id", "name"],
      },
    });

    if (!user) {
      return unauthorizedError(req, res);
    }

    // Refresh session expire time
    req.session.touch();
    req.user = user;

    next();
  };

function validateSession(session: Session) {
  return new RequestDataValidator<SessionDTO>(
    {
      userId: session.userId,
    },
    Joi.object({
      userId: Joi.number().required(),
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
  logger.error(
    `Unknown error during session validation: ${JSON.stringify(err)}`
  );

  return res
    .send({ error: ServerResponse.INTERNAL_SERVER_ERROR })
    .status(HttpStatus.INTERNAL);
}

async function unauthorizedError(req: Request, res: Response) {
  return res.status(HttpStatus.UNAUTHORIZED).json({
    error: await ts.localize(ClientResponse.ACCESS_DENIED, req.headers),
  });
}

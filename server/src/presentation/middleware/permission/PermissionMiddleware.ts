import { type NextFunction, type Request, type Response } from "express";
import { container } from "tsyringe";

import { TranslateService as ts } from "application/services/text/TranslateService";
import { UserService } from "application/services/user/UserService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { type Permissions } from "domain/enums/Permissions";
import { ClientError } from "domain/errors/ClientError";
import { ErrorController } from "domain/errors/ErrorController";
import { Permission } from "infrastructure/database/models/Permission";
import { ILogger } from "infrastructure/logger/ILogger";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

export function checkPermissionMiddleware(
  permission: Permissions,
  logger: ILogger
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await container.resolve(UserService).getUserByRequest(req, {
        select: ["id"],
        relations: ["permissions"],
        relationSelects: { permissions: ["id", "name"] },
      });

      if (!user || user.is_deleted || user.is_banned) {
        throw new ClientError(
          ClientResponse.ACCESS_DENIED,
          HttpStatus.UNAUTHORIZED
        );
      }

      if (await Permission.checkPermission(user, permission)) {
        return next();
      }

      return res.status(HttpStatus.FORBIDDEN).send({
        error: await ts.localize(ClientResponse.NO_PERMISSION, req.headers),
      });
    } catch (err: unknown) {
      const { message, code } = await ErrorController.resolveError(
        err,
        logger,
        req.headers
      );
      return res.status(code).send({ error: message });
    }
  };
}

/**
 * Require some permission from user, that makes request, if he passed
 * the id in request params, which means he's doing request on another user
 */
export function checkPermissionWithId(
  permission: Permissions,
  logger: ILogger
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.params.id) {
      try {
        const id = ValueUtils.validateId(req.params.id);

        const requestUser = await container
          .resolve(UserService)
          .getUserByRequest(req, {
            select: ["id"],
            relations: ["permissions"],
            relationSelects: { permissions: ["id", "name"] },
          });

        if (!requestUser) {
          throw new ClientError(ClientResponse.ACCESS_DENIED);
        }

        if (id === requestUser?.id) {
          return next();
        }

        if (await Permission.checkPermission(requestUser, permission)) {
          return next();
        }

        return res.status(HttpStatus.FORBIDDEN).send({
          error: await ts.localize(ClientResponse.NO_PERMISSION, req.headers),
        });
      } catch (err: unknown) {
        const { message, code } = await ErrorController.resolveError(
          err,
          logger,
          req.headers
        );
        return res.status(code).send({ error: message });
      }
    } else {
      throw new ClientError(ClientResponse.BAD_USER_ID);
    }
  };
}

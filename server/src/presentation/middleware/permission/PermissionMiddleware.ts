import { type NextFunction, type Request, type Response } from "express";
import { container } from "tsyringe";

import { TranslateService as ts } from "domain/utils/TranslateService";
import { UserService } from "application/services/user/UserService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { type Permissions } from "domain/enums/Permissions";
import { ClientError } from "domain/errors/ClientError";
import { ErrorController } from "domain/errors/ErrorController";
import { ILogger } from "shared/logging/ILogger";
import { ValueUtils } from "domain/utils/ValueUtils";

export function checkPermissionMiddleware(permission: Permissions, logger: ILogger) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (
        await container.resolve(UserService).hasPermission({
          sessionUserId: req.session.userId,
          permission
        })
      ) {
        return next();
      }

      return res.status(HttpStatus.FORBIDDEN).send({
        error: await ts.localize(ClientResponse.NO_PERMISSION, req.headers["accept-language"])
      });
    } catch (err: unknown) {
      const { message, code } = await ErrorController.resolveError(err, logger, req.headers);
      return res.status(code).send({ error: message });
    }
  };
}

/**
 * Require some permission from user, that makes request, if he passed
 * the id in request params, which means he's doing request on another user
 */
export function checkPermissionWithId(permission: Permissions, logger: ILogger) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.params.id) {
      try {
        const id = ValueUtils.validateId(req.params.id);

        if (
          await container.resolve(UserService).canManageTargetUser({
            sessionUserId: req.session.userId,
            targetUserId: id,
            permission
          })
        ) {
          return next();
        }

        return res.status(HttpStatus.FORBIDDEN).send({
          error: await ts.localize(ClientResponse.NO_PERMISSION, req.headers["accept-language"])
        });
      } catch (err: unknown) {
        const { message, code } = await ErrorController.resolveError(err, logger, req.headers);
        return res.status(code).send({ error: message });
      }
    } else {
      throw new ClientError(ClientResponse.BAD_USER_ID);
    }
  };
}

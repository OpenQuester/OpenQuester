import { type NextFunction, type Request, type Response } from "express";

import { PackageService } from "application/services/package/PackageService";
import { TranslateService as ts } from "domain/utils/TranslateService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ErrorController } from "domain/errors/ErrorController";
import { ILogger } from "shared/logging/ILogger";
import { ValueUtils } from "domain/utils/ValueUtils";

/**
 * Check if user has DELETE_PACKAGE permission OR is the package author
 */
export function checkPackDeletePermissionMiddleware(
  packageService: PackageService,
  logger: ILogger
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const packageId = ValueUtils.validateId(req.params.id);

      if (
        await packageService.canDeletePackage({
          packageId,
          sessionUserId: req.session.userId
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

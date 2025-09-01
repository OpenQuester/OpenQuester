import { type NextFunction, type Request, type Response } from "express";

import { PackageService } from "application/services/package/PackageService";
import { TranslateService as ts } from "application/services/text/TranslateService";
import { UserService } from "application/services/user/UserService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { Permissions } from "domain/enums/Permissions";
import { ClientError } from "domain/errors/ClientError";
import { ErrorController } from "domain/errors/ErrorController";
import { Permission } from "infrastructure/database/models/Permission";
import { ILogger } from "infrastructure/logger/ILogger";
import { ValueUtils } from "infrastructure/utils/ValueUtils";

/**
 * Check if user has DELETE_PACKAGE permission OR is the package author
 */
export function checkPackDeletePermissionMiddleware(
  packageService: PackageService,
  userService: UserService,
  logger: ILogger
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const packageId = ValueUtils.validateId(req.params.id);

      // Get the current user with permissions
      const user = await userService.getUserByRequest(req, {
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

      // Check if user has DELETE_PACKAGE permission
      const hasDeletePermission = await Permission.checkPermission(
        user,
        Permissions.DELETE_PACKAGE
      );

      if (hasDeletePermission) {
        return next();
      }

      // If user doesn't have DELETE_PACKAGE permission, check if they are the package author
      const packageEntity = await packageService.getPackageRaw(
        packageId,
        ["id"],
        ["author"]
      );

      if (!packageEntity) {
        throw new ClientError(
          ClientResponse.PACKAGE_NOT_FOUND,
          HttpStatus.NOT_FOUND
        );
      }

      if (packageEntity.author && packageEntity.author.id === user.id) {
        return next();
      }

      // User doesn't have permission and is not the package author
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

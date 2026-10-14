import { type Express, type Request, type Response, Router } from "express";
import Joi from "joi";
import { container } from "tsyringe";

import { StorageQuotaService } from "application/services/storage/StorageQuotaService";
import { HttpStatus } from "domain/enums/HttpStatus";
import { Permissions } from "domain/enums/Permissions";
import { StorageGroup, type StorageLimits } from "domain/types/storage/StorageTypes";
import { type ILogger } from "shared/logging/ILogger";
import { asyncHandler } from "presentation/middleware/asyncHandlerMiddleware";
import { checkPermissionMiddleware } from "presentation/middleware/permission/PermissionMiddleware";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";

/** Bytes, or null for no limit. */
const limit = Joi.number().integer().min(0).allow(null).required();

const groupLimitsScheme = () =>
  Joi.object<StorageLimits & { group: StorageGroup }>({
    group: Joi.string()
      .valid(...Object.values(StorageGroup))
      .required(),
    userQuotaBytes: limit,
    packageBytes: limit,
    imageBytes: limit,
    audioBytes: limit,
    videoBytes: limit
  });

const userQuotaScheme = () =>
  Joi.object<{ userId: number; quotaBytes: number | null }>({
    userId: Joi.number().integer().min(1).required(),
    quotaBytes: limit
  });

/** Admin panel: bucket usage, per-group limits and per-user quotas. */
export class StorageRestApiController {
  constructor(
    private readonly app: Express,
    private readonly logger: ILogger
  ) {
    const router = Router();
    this.app.use("/v1/admin/api/storage", router);

    router.get(
      "/",
      checkPermissionMiddleware(Permissions.ADMIN_PANEL_ACCESS, this.logger),
      asyncHandler(this.getStorage)
    );
    router.put(
      "/groups/:group",
      checkPermissionMiddleware(Permissions.MANAGE_STORAGE, this.logger),
      asyncHandler(this.setGroupLimits)
    );
    router.put(
      "/users/:id",
      checkPermissionMiddleware(Permissions.MANAGE_STORAGE, this.logger),
      asyncHandler(this.setUserQuota)
    );
  }

  private get service() {
    return container.resolve(StorageQuotaService);
  }

  private getStorage = async (_req: Request, res: Response) => {
    res.status(HttpStatus.OK).send(await this.service.getAdminStorage());
  };

  private setGroupLimits = async (req: Request, res: Response) => {
    const { group, ...limits } = new RequestDataValidator<StorageLimits & { group: StorageGroup }>(
      { ...req.body, group: req.params.group },
      groupLimitsScheme()
    ).validate();
    res.status(HttpStatus.OK).send(await this.service.setGroupLimits(group, limits));
  };

  private setUserQuota = async (req: Request, res: Response) => {
    const { userId, quotaBytes } = new RequestDataValidator<{
      userId: number;
      quotaBytes: number | null;
    }>({ userId: Number(req.params.id), quotaBytes: req.body?.quotaBytes }, userQuotaScheme()).validate();
    await this.service.setUserQuota(userId, quotaBytes);
    res.status(HttpStatus.NO_CONTENT).send();
  };
}

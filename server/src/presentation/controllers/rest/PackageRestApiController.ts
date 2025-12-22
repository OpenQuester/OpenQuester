import { Router, type Express, type Request, type Response } from "express";

import { PackageService } from "application/services/package/PackageService";
import { UserService } from "application/services/user/UserService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PackageInputDTO } from "domain/types/dto/package/PackageInputDTO";
import { PackageSearchOpts } from "domain/types/pagination/package/PackageSearchOpts";
import { ILogger } from "infrastructure/logger/ILogger";
import { asyncHandler } from "presentation/middleware/asyncHandlerMiddleware";
import { checkPackDeletePermissionMiddleware } from "presentation/middleware/permission/PackagePermissionMiddleware";
import {
  packageSearchScheme,
  packIdScheme,
  uploadPackageScheme,
} from "presentation/schemes/package/packageSchemes";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";

export class PackageRestApiController {
  constructor(
    private readonly app: Express,
    private readonly packageService: PackageService,
    private readonly userService: UserService,
    private readonly logger: ILogger
  ) {
    const router = Router();

    this.app.use("/v1/packages", router);

    router.post("/", asyncHandler(this.uploadPackage));
    router.get("/", asyncHandler(this.listPackages));
    router.get("/:id", asyncHandler(this.getPackage));
    router.delete(
      "/:id",
      checkPackDeletePermissionMiddleware(
        this.packageService,
        this.userService,
        this.logger
      ),
      asyncHandler(this.deletePackage)
    );
  }

  private uploadPackage = async (req: Request, res: Response) => {
    // Check if user is a guest - guests cannot upload packages
    if (req.user?.is_guest) {
      throw new ClientError(
        ClientResponse.CANNOT_UPLOAD_PACKAGE_AS_GUEST,
        HttpStatus.FORBIDDEN
      );
    }

    // Validate and get data that can be safely saved in DB
    const validatedData = new RequestDataValidator<{
      content: PackageDTO;
    }>(req.body, uploadPackageScheme()).validate();

    const data = await this.packageService.uploadPackage(
      req,
      validatedData.content
    );
    return res.status(HttpStatus.OK).send(data);
  };

  private getPackage = async (req: Request, res: Response) => {
    const validatedData = new RequestDataValidator<PackageInputDTO>(
      { packageId: Number(req.params.id) },
      packIdScheme()
    ).validate();

    const data = await this.packageService.getPackage(validatedData.packageId);
    return res.status(HttpStatus.OK).send(data);
  };

  private listPackages = async (req: Request, res: Response) => {
    // Unified list endpoint with search/filter support
    const searchOpts = new RequestDataValidator<PackageSearchOpts>(
      req.query as unknown as PackageSearchOpts,
      packageSearchScheme()
    ).validate();

    const data = await this.packageService.searchPackages(searchOpts);

    return res.status(HttpStatus.OK).send(data);
  };

  private deletePackage = async (req: Request, res: Response) => {
    const validatedData = new RequestDataValidator<PackageInputDTO>(
      { packageId: Number(req.params.id) },
      packIdScheme()
    ).validate();

    this.logger.info("Package deletion initiated", {
      packageId: validatedData.packageId,
      userId: req.user?.id,
    });

    await this.packageService.deletePackage(validatedData.packageId);

    return res.status(HttpStatus.OK).send({
      message: "Package deleted successfully",
    });
  };
}

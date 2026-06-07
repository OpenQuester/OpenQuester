import { Router, type Express, type Request, type Response } from "express";

import { PackageService } from "application/services/package/PackageService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { ClientError } from "domain/errors/ClientError";
import { type PackageDTO } from "domain/types/dto/package/PackageDTO";
import { type PackageInputDTO } from "domain/types/dto/package/PackageInputDTO";
import { type PackageSearchOpts } from "domain/types/pagination/package/PackageSearchOpts";
import { type ILogger } from "shared/logging/ILogger";
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
        this.logger
      ),
      asyncHandler(this.deletePackage)
    );
  }

  private uploadPackage = async (req: Request, res: Response) => {
    // Validate and get data that can be safely saved in DB
    const validatedData = new RequestDataValidator<{
      content: PackageDTO;
    }>(req.body, uploadPackageScheme()).validate();

    const data = await this.packageService.uploadPackageForSession({
      sessionUserId: req.session.userId,
      packageData: validatedData.content
    });
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

    this._validateMinMaxRanges(searchOpts);

    const data = await this.packageService.searchPackages(searchOpts);

    return res.status(HttpStatus.OK).send(data);
  };

  private deletePackage = async (req: Request, res: Response) => {
    const validatedData = new RequestDataValidator<PackageInputDTO>(
      { packageId: Number(req.params.id) },
      packIdScheme()
    ).validate();

    await this.packageService.deletePackage(validatedData.packageId);

    return res.status(HttpStatus.OK).send({
      message: "Package deleted successfully",
    });
  };

  private _validateMinMaxRanges(opts: PackageSearchOpts): void {
    if (
      opts.minRounds !== undefined &&
      opts.maxRounds !== undefined &&
      opts.minRounds > opts.maxRounds
    ) {
      throw new ClientError(ClientResponse.PACKAGE_SEARCH_ROUNDS_MIN_MORE_MAX);
    }

    if (
      opts.minQuestions !== undefined &&
      opts.maxQuestions !== undefined &&
      opts.minQuestions > opts.maxQuestions
    ) {
      throw new ClientError(
        ClientResponse.PACKAGE_SEARCH_QUESTIONS_MIN_MORE_MAX
      );
    }
  }
}

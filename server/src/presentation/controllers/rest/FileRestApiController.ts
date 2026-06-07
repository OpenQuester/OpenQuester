import { Router, type Express, type Request, type Response } from "express";

import { type FileStorageService } from "application/services/file/FileStorageService";
import { TranslateService as ts } from "domain/utils/TranslateService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { asyncHandler } from "presentation/middleware/asyncHandlerMiddleware";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";
import { filenameScheme } from "presentation/schemes/file/fileSchemes";

export class FileRestApiController {
  constructor(
    private readonly app: Express,
    private readonly fileStorageService: FileStorageService
  ) {
    const router = Router();

    this.app.use("/v1/files", router);

    router.get("/:filename", asyncHandler(this.getFile));
    router.post("/:filename", asyncHandler(this.uploadFile));
    router.delete("/:filename", asyncHandler(this.deleteFile));
  }

  private getFile = async (req: Request, res: Response) => {
    const validatedData = this._validateParamsFilename(req);

    const url = this.fileStorageService.getUrl(validatedData.filename);
    res.send({ url });
  };

  private uploadFile = async (req: Request, res: Response) => {
    const validatedData = this._validateParamsFilename(req);

    const url = await this.fileStorageService.upload(validatedData.filename);
    res.send({ url });
  };

  private deleteFile = async (req: Request, res: Response) => {
    const validatedData = this._validateParamsFilename(req);

    await this.fileStorageService.delete(validatedData.filename, req.session.userId);

    res.status(HttpStatus.NO_CONTENT).send({
      message: await ts.localize(ClientResponse.DELETE_REQUEST_SENT, req.headers["accept-language"])
    });
  };

  private _validateParamsFilename(req: Request) {
    return new RequestDataValidator<{ filename: string }>(
      { filename: req.params.filename },
      filenameScheme()
    ).validate();
  }
}

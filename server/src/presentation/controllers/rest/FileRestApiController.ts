import { Router, type Express, type Request, type Response } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { type FileStorageService } from "application/services/file/FileStorageService";
import { TranslateService as ts } from "domain/utils/TranslateService";
import { ByteUtils } from "domain/utils/ByteUtils";
import { ClientError } from "domain/errors/ClientError";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { asyncHandler } from "presentation/middleware/asyncHandlerMiddleware";
import { RequestDataValidator } from "presentation/schemes/RequestDataValidator";
import { filenameScheme } from "presentation/schemes/file/fileSchemes";

/** Same cap as the web package editor: larger files are never proxied through the API. */
const MAX_PROXIED_FILE_BYTES = 100 * 1024 * 1024;

export class FileRestApiController {
  constructor(
    private readonly app: Express,
    private readonly fileStorageService: FileStorageService
  ) {
    const router = Router();

    this.app.use("/v1/files", router);

    router.get("/:filename", asyncHandler(this.getFile));
    router.get("/:filename/content", asyncHandler(this.getFileContent));
    router.post("/:filename", asyncHandler(this.uploadFile));
    router.delete("/:filename", asyncHandler(this.deleteFile));
  }

  private getFile = async (req: Request, res: Response) => {
    const validatedData = this._validateParamsFilename(req);

    const url = this.fileStorageService.getUrl(validatedData.filename);
    res.send({ url });
  };

  /**
   * Streams a stored file from the API's own origin. The web media editor needs
   * the bytes, and a cross-origin fetch of the public bucket link fails when the
   * bucket (or a CDN cache in front of it) sends no CORS headers.
   */
  private getFileContent = async (req: Request, res: Response) => {
    if (!req.session.userId) {
      throw new ClientError(ClientResponse.STORAGE_SIGN_IN_TO_READ, HttpStatus.UNAUTHORIZED);
    }

    const validatedData = this._validateParamsFilename(req);

    const object = await this.fileStorageService.getContent(validatedData.filename);
    if (!object) {
      throw new ClientError(ClientResponse.STORAGE_FILE_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    if (object.size !== undefined && object.size > MAX_PROXIED_FILE_BYTES) {
      (object.body as Readable).destroy();
      throw new ClientError(ClientResponse.STORAGE_FILE_TOO_LARGE, HttpStatus.PAYLOAD_TOO_LARGE, {
        kind: "media",
        size: ByteUtils.format(object.size),
        limit: ByteUtils.format(MAX_PROXIED_FILE_BYTES)
      });
    }

    // Uploads are user content served from the app's own origin: never let a
    // browser render one (an SVG or HTML file would run as this site).
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    if (object.size !== undefined) {
      res.setHeader("Content-Length", String(object.size));
    }
    // Files are content-addressed (md5), so a copy never goes stale.
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");

    try {
      await pipeline(object.body as Readable, res);
    } catch (error) {
      // Once bytes are out, the error middleware can't answer any more: a client
      // that cancels its download (or a storage stream cut mid-transfer) just
      // ends this response.
      if (!res.headersSent) {
        throw error;
      }

      res.destroy();
    }
  };

  private uploadFile = async (req: Request, res: Response) => {
    // Reading a link stays public; storing a file needs an account (guests included).
    if (!req.session.userId) {
      throw new ClientError(ClientResponse.STORAGE_SIGN_IN_TO_UPLOAD, HttpStatus.UNAUTHORIZED);
    }

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

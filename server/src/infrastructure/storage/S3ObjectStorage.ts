import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { type S3Context } from "domain/types/file/S3Context";
import {
  type ObjectStorage,
  type ObjectStorageDeleteResult,
  type ObjectStorageItem,
  type ObjectStoragePutRequest,
  type PresignedUrlRequest
} from "shared/storage/ObjectStorage";
import { ValueUtils } from "domain/utils/ValueUtils";

@singleton()
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(@inject(DI_TOKENS.S3Context) private readonly s3Context: S3Context) {
    this.client = new S3Client({
      credentials: {
        accessKeyId: this.s3Context.accessKey,
        secretAccessKey: this.s3Context.secretKey
      },
      forcePathStyle: true,
      endpoint: this.s3Context.endpoint,
      region: this.s3Context.region
    });
  }

  public getIgnoredCleanupFolder(): string {
    return this.s3Context.ignoredCleanupFolder || "";
  }

  public async generatePresignedUrl(input: PresignedUrlRequest): Promise<string> {
    if (input.operation === "PUT") {
      const command = new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        ContentMD5: input.contentMd5Hex
          ? Buffer.from(input.contentMd5Hex, "hex").toString("base64")
          : undefined,
        IfNoneMatch: "*"
      });

      return getSignedUrl(this.client, command, {
        expiresIn: input.expiresInSeconds,
        unhoistableHeaders: new Set(["Content-MD5", "If-None-Match"])
      });
    }

    const command = new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.key
    });

    return getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds
    });
  }

  public async putObject(input: ObjectStoragePutRequest): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      Body: input.body,
      ContentLength: input.contentLength
    });

    await this.client.send(command);
  }

  public async deleteObject(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    });

    await this.client.send(command);
  }

  public async deleteObjects(bucket: string, keys: string[]): Promise<ObjectStorageDeleteResult> {
    if (keys.length === 0) {
      return { errors: [] };
    }

    const objects = keys.map((key) => ({ Key: key }));
    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: objects,
        Quiet: true
      }
    });

    this.applyMinioContentMD5Workaround(command, objects);

    const result = await this.client.send(command);
    return {
      errors:
        result.Errors?.map((error) => ({
          key: error.Key,
          code: error.Code,
          message: error.Message
        })) ?? []
    };
  }

  public async *listObjectsInBatches(
    bucket: string,
    batchSize: number
  ): AsyncGenerator<ObjectStorageItem[]> {
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        MaxKeys: batchSize,
        ContinuationToken: continuationToken
      });

      const response = await this.client.send(command);

      if (response.Contents && response.Contents.length > 0) {
        yield response.Contents.filter((obj) => obj.Key).map((obj) => {
          const key = obj.Key!;
          const parts = key.split("/");
          const filename = parts[parts.length - 1];
          return { filename, key };
        });
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
  }

  private applyMinioContentMD5Workaround(
    command: DeleteObjectsCommand,
    objects: Array<{ Key: string }>
  ): void {
    const xmlBody = this.buildDeleteXmlBody(objects);
    const contentMD5 = createHash("md5").update(xmlBody).digest("base64");

    command.middlewareStack.addRelativeTo(
      (next: any) => async (args: any) => {
        if (args.request && args.request.headers) {
          args.request.headers["content-md5"] = contentMD5;
        }
        return next(args);
      },
      {
        relation: "after",
        toMiddleware: "serializerMiddleware",
        name: "addContentMD5Middleware"
      }
    );
  }

  private buildDeleteXmlBody(objects: Array<{ Key: string }>): string {
    const objectsXml = objects
      .map((obj) => `<Object><Key>${ValueUtils.escapeXml(obj.Key)}</Key></Object>`)
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?><Delete xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Quiet>true</Quiet>${objectsXml}</Delete>`;
  }
}

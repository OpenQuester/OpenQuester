export interface PresignedUrlRequest {
  operation: "PUT" | "GET";
  bucket: string;
  key: string;
  expiresInSeconds: number;
  contentMd5Hex?: string;
}

export interface ObjectStoragePutRequest {
  bucket: string;
  key: string;
  body: Buffer;
  contentLength?: number;
}

export interface ObjectStorageDeleteError {
  key?: string;
  code?: string;
  message?: string;
}

export interface ObjectStorageDeleteResult {
  errors: ObjectStorageDeleteError[];
}

export interface ObjectStorageItem {
  filename: string;
  key: string;
}

export interface ObjectStorage {
  getIgnoredCleanupFolder(): string;
  generatePresignedUrl(input: PresignedUrlRequest): Promise<string>;
  putObject(input: ObjectStoragePutRequest): Promise<void>;
  deleteObject(bucket: string, key: string): Promise<void>;
  deleteObjects(bucket: string, keys: string[]): Promise<ObjectStorageDeleteResult>;
  listObjectsInBatches(bucket: string, batchSize: number): AsyncGenerator<ObjectStorageItem[]>;
}

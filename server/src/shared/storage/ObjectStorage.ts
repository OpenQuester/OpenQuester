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
  /** Bytes, when the listing reports it. */
  size?: number;
}

export interface ObjectStorage {
  getIgnoredCleanupFolder(): string;
  generatePresignedUrl(input: PresignedUrlRequest): Promise<string>;
  putObject(input: ObjectStoragePutRequest): Promise<void>;
  deleteObject(bucket: string, key: string): Promise<void>;
  /** Size of a stored object, or null when it doesn't exist. */
  headObject(bucket: string, key: string): Promise<{ size: number } | null>;
  deleteObjects(bucket: string, keys: string[]): Promise<ObjectStorageDeleteResult>;
  listObjectsInBatches(bucket: string, batchSize: number): AsyncGenerator<ObjectStorageItem[]>;
}

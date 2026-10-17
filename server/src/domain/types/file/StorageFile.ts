export interface StorageFilename {
  filename: string;
}

/** A content-addressed file and its directory in object storage. */
export interface StorageFile extends StorageFilename {
  path: string;
}

/** Whether storage has confirmed the file exists. */
export interface StorageFileState extends StorageFile {
  verified: boolean;
}

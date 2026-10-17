/** A content-addressed file and its directory in object storage. */
export interface StorageFile {
  filename: string;
  path: string;
}

/** Whether storage has confirmed the file exists. */
export interface StorageFileState extends StorageFile {
  verified: boolean;
}

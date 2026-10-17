export interface StorageFilename {
  /** The file's MD5, with or without extension. */
  filename: string;
}

/** Where a stored file lives in the bucket: `${path}${filename}`. */
export interface FileLocation extends StorageFilename {
  path: string;
}

/** A package media file and whether storage has confirmed it holds it. */
export interface PackageFileState extends FileLocation {
  verified: boolean;
}

/** Where a stored file lives in the bucket: `${path}${filename}`. */
export interface FileLocation {
  /** The file's MD5, with or without extension. */
  filename: string;
  path: string;
}

/** A package media file and whether storage has confirmed it holds it. */
export interface PackageFileState extends FileLocation {
  verified: boolean;
}

import { type PackageDTO } from "domain/types/dto/package/PackageDTO";

/** Client-measured bytes keyed by a media file's MD5, optionally with its extension. */
export interface PackageFileSizes {
  [filename: string]: number;
}

/** Validated POST/PUT package body; the same contract applies to creation and replacement. */
export interface PackageUploadRequestDTO {
  content: PackageDTO;
  fileSizes?: PackageFileSizes;
  /** Undefined preserves the fingerprint on edits; null clears it. */
  sourceHash?: string | null;
}

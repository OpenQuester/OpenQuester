import { type PackageDTO } from "domain/types/dto/package/PackageDTO";
import { type ClientFileSizes } from "domain/types/storage/StorageTypes";

/** Body of POST /v1/packages and PUT /v1/packages/{id}. */
export interface PackageUploadBody {
  content: PackageDTO;
  /** Sizes of the package's media files, checked against the storage limits. */
  fileSizes?: ClientFileSizes;
  /** Fingerprint of the imported file, so a second upload of it can be spotted. */
  sourceHash?: string | null;
}

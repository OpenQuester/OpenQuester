import { type Package } from "infrastructure/database/models/package/Package";
import { type User } from "infrastructure/database/models/User";

/** Package and active session user after the edit permission check. */
export interface PackageEditContext {
  user: User;
  packageEntity: Package;
}

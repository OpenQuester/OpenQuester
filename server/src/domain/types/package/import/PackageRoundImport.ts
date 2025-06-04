import { Package } from "infrastructure/database/models/package/Package";
import { PackageRoundType } from "../PackageRoundType";

export interface PackageRoundImport {
  name: string;
  description?: string | null;
  package: Package;
  order: number;
  type: PackageRoundType;
}

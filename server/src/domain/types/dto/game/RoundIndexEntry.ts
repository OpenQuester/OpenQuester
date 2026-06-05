import { type PackageRoundType } from "domain/types/package/PackageRoundType";

export interface RoundIndexEntry {
  order: number;
  type: PackageRoundType;
}

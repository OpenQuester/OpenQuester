import { PackageThemeDTO } from "domain/types/dto/package/PackageThemeDTO";
import { PackageRoundType } from "domain/types/package/PackageRoundType";

export interface PackageRoundDTO {
  id?: number;
  name: string;
  order: number;
  description?: string | null;
  themes: PackageThemeDTO[];
  type: PackageRoundType;
}

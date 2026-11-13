import { PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";

export interface PackageAnswerDTO {
  id?: number;
  text?: string | null;
  sourceLabel?: string | null;
  file: PackageFileDTO | null;
  order: number;
}

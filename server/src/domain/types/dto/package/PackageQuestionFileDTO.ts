import { PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";

export interface PackageQuestionFileDTO {
  file: PackageFileDTO;
  displayTime: number | null;
  order: number;
}

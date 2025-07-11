import { PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";

export interface PackageAnswerFileDTO {
  file: PackageFileDTO;
  displayTime: number | null;
  order: number;
}

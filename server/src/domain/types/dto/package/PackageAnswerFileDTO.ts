import { ContentPlacement } from "domain/enums/package/ContentPlacement";
import { PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";

export interface PackageAnswerFileDTO {
  file: PackageFileDTO;
  displayTime: number | null;
  order: number;
  /** Defaults to screen */
  placement?: ContentPlacement;
  /** When false, the next item is shown together with this one. Defaults to true */
  waitForFinish?: boolean;
}

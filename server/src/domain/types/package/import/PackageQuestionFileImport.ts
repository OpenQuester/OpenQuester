import { PackageFileType } from "domain/enums/package/PackageFileType";
import { File } from "infrastructure/database/models/File";
import { PackageQuestion } from "infrastructure/database/models/package/PackageQuestion";

export interface PackageQuestionFileImport {
  file: File;
  order: number;
  type: PackageFileType;
  display_time: number | null;
  question: PackageQuestion;
}

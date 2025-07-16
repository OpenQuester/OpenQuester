import { PackageFileType } from "domain/enums/package/PackageFileType";

export interface PackageFileDTO {
  id?: number;
  md5: string; // filename
  type: PackageFileType;
  link?: string;
  size?: number; // file size in bytes
}

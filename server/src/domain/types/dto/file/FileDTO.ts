import { FileSource } from "domain/enums/file/FileSource";

export interface FileDTO {
  path: string;
  filename: string;
  source: FileSource;
  created_at: Date;
  size?: number;
}

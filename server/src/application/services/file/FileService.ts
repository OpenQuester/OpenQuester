import { singleton } from "tsyringe";

import { FileSource } from "domain/enums/file/FileSource";
import { FileRepository } from "infrastructure/database/repositories/FileRepository";

/**
 * Service for file entity operations.
 */
@singleton()
export class FileService {
  constructor(private readonly fileRepository: FileRepository) {
    //
  }

  public async writeFile(path: string, filename: string, source: FileSource) {
    return this.fileRepository.writeFile(path, filename, source);
  }

  public async getFileByFilename(filename: string) {
    return this.fileRepository.getFileByFilename(filename);
  }

  /**
   * Remove file record from DB if it exists
   */
  public async removeFile(filename: string) {
    return this.fileRepository.removeFile(filename);
  }

  /**
   * Check which filenames exist in the database
   * Returns only the filenames that were found
   */
  public async getExistingFilenames(filenames: string[]): Promise<string[]> {
    return this.fileRepository.getExistingFilenames(filenames);
  }
}

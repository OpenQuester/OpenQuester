import { FileSource } from "domain/enums/file/FileSource";
import { FileDTO } from "domain/types/dto/file/FileDTO";
import { FileRepository } from "infrastructure/database/repositories/FileRepository";

export class FileService {
  constructor(private readonly fileRepository: FileRepository) {
    //
  }

  public async bulkWriteFiles(files: FileDTO[]) {
    return this.fileRepository.bulkWriteFiles(files);
  }

  public async writeFile(path: string, filename: string, source: FileSource) {
    return this.fileRepository.writeFile(path, filename, source);
  }

  public async getFile(id: number) {
    return this.fileRepository.getFile(id);
  }

  public async getFileByFilename(filename: string) {
    return this.fileRepository.getFileByFilename(filename);
  }

  /**
   * Get multiple files by their filenames - optimized with IN clause
   */
  public async getFilesByFilenames(filenames: string[]) {
    return this.fileRepository.getFilesByFilenames(filenames);
  }

  /**
   * Remove file record from DB if it exists
   */
  public async removeFile(filename: string) {
    return this.fileRepository.removeFile(filename);
  }

  /**
   * Get all filenames from database in batches for memory efficiency
   */
  public async getAllFilenames(): Promise<string[]> {
    return this.fileRepository.getAllFilenames();
  }

  /**
   * Check which filenames exist in the database
   * Returns only the filenames that were found
   */
  public async getExistingFilenames(filenames: string[]): Promise<string[]> {
    return this.fileRepository.getExistingFilenames(filenames);
  }
}

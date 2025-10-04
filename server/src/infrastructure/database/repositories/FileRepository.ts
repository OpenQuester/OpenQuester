import { In, type Repository } from "typeorm";

import { FileSource } from "domain/enums/file/FileSource";
import { FileDTO } from "domain/types/dto/file/FileDTO";
import { File } from "infrastructure/database/models/File";

export class FileRepository {
  constructor(private readonly repository: Repository<File>) {
    //
  }

  public async bulkWriteFiles(files: FileDTO[]) {
    return this.repository.insert(files);
  }

  public async writeFile(path: string, filename: string, source: FileSource) {
    const existingFile = await this.repository.findOne({
      where: {
        filename,
        path,
        source,
      },
    });
    if (existingFile) {
      return existingFile;
    }

    const file = new File();
    file.import({
      path,
      filename,
      source,
      created_at: new Date(),
    });

    return this.repository.save(file);
  }

  public async getFile(id: number) {
    return this.repository.findOne({
      where: { id },
    });
  }

  public async getFileByFilename(filename: string) {
    return this.repository.findOne({
      where: { filename },
    });
  }

  /**
   * Get multiple files by their filenames using IN clause for performance
   */
  public async getFilesByFilenames(filenames: string[]): Promise<File[]> {
    if (filenames.length === 0) {
      return [];
    }
    return this.repository.find({
      where: { filename: In(filenames) },
    });
  }

  /**
   * Remove file record from DB if it exists
   */
  public async removeFile(filename: string) {
    const file = await this.getFileByFilename(filename);
    if (file?.id && file.id > 0) {
      return this.repository.delete({ id: file.id });
    }
  }

  /**
   * Get all filenames from database
   * Uses SELECT filename to minimize memory usage for large datasets
   */
  public async getAllFilenames(): Promise<string[]> {
    const result = await this.repository
      .createQueryBuilder("file")
      .select("file.filename")
      .getMany();

    return result.map((file) => file.filename);
  }

  /**
   * Check which filenames exist in the database
   * Returns only the filenames that were found in DB
   * Optimized for batch checking during cleanup operations
   */
  public async getExistingFilenames(filenames: string[]): Promise<string[]> {
    if (filenames.length === 0) {
      return [];
    }

    const result = await this.repository
      .createQueryBuilder("file")
      .select("file.filename")
      .where("file.filename IN (:...filenames)", { filenames })
      .getMany();

    return result.map((file) => file.filename);
  }
}

import { type File } from "infrastructure/database/models/File";
import { type Package } from "infrastructure/database/models/package/Package";
import { type User } from "infrastructure/database/models/User";
import { FileUsageRepository } from "infrastructure/database/repositories/FileUsageRepository";

export class FileUsageService {
  constructor(private readonly fileUsageRepository: FileUsageRepository) {
    //
  }

  public async getUsage(file: File) {
    return this.fileUsageRepository.getUsage(file);
  }

  /**
   * Get usage records for multiple files by their filenames - optimized bulk operation
   */
  public async getBulkUsageByFilenames(filenames: string[]) {
    return this.fileUsageRepository.getBulkUsageByFilenames(filenames);
  }

  public async writeUsage(file: File, user?: User, pack?: Package) {
    return this.fileUsageRepository.writeUsage(file, user, pack);
  }

  public async writeBulkUsage(filesData: {
    files: File[];
    user?: User;
    pack?: Package;
  }) {
    return this.fileUsageRepository.writeBulkUsage(filesData);
  }

  public async deleteUsage(file: File, user?: User, pack?: Package) {
    return this.fileUsageRepository.deleteUsage(file, user, pack);
  }
}

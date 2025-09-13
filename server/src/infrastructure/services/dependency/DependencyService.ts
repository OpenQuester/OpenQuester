import { FileService } from "application/services/file/FileService";
import { FileUsageService } from "application/services/file/FileUsageService";

export class DependencyService {
  constructor(
    private readonly fileService: FileService,
    private readonly fileUsageService: FileUsageService
  ) {
    //
  }

  /**
   * Return array of file usage
   */
  public async getFileUsage(filename: string) {
    const file = await this.fileService.getFileByFilename(filename);

    if (!file) {
      return [];
    }

    return this.fileUsageService.getUsage(file);
  }

  /**
   * Return map of file usage for multiple filenames - optimized bulk operation
   */
  public async getBulkFileUsage(
    filenames: string[]
  ): Promise<Map<string, any[]>> {
    if (filenames.length === 0) {
      return new Map();
    }

    // Get all usage records for the filenames in a single query
    const allUsageRecords = await this.fileUsageService.getBulkUsageByFilenames(
      filenames
    );

    // Group usage records by filename
    const usageMap = new Map<string, any[]>();

    // Initialize map with empty arrays for all requested filenames
    for (const filename of filenames) {
      usageMap.set(filename, []);
    }

    // Populate the map with actual usage records
    for (const usage of allUsageRecords) {
      if (usage.file?.filename) {
        const existingUsage = usageMap.get(usage.file.filename) || [];
        existingUsage.push(usage);
        usageMap.set(usage.file.filename, existingUsage);
      }
    }

    return usageMap;
  }
}

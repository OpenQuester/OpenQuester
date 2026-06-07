import { stat } from "fs/promises";
import { access, constants, open } from "fs/promises";
import { singleton } from "tsyringe";

import { getUnifiedLogPath } from "infrastructure/logger/PinoLogger";
import { LogFileReader } from "shared/logging/LogFileReader";

/** Default chunk size for reading log file from end (64KB). */
const READ_CHUNK_SIZE = 64 * 1024;

@singleton()
export class FileSystemLogFileReader implements LogFileReader {
  private readonly logPath: string;

  constructor() {
    this.logPath = getUnifiedLogPath();
  }

  public async exists(): Promise<boolean> {
    try {
      await access(this.logPath, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  public async *readLinesFromEnd(): AsyncGenerator<string> {
    const stats = await stat(this.logPath);
    const fileSize = stats.size;

    if (fileSize === 0) return;

    const fd = await open(this.logPath, "r");

    try {
      let position = fileSize;
      let leftover = "";

      while (position > 0) {
        const chunkSize = Math.min(READ_CHUNK_SIZE, position);
        position -= chunkSize;

        const buffer = Buffer.alloc(chunkSize);
        await fd.read(buffer, 0, chunkSize, position);
        const chunk = buffer.toString("utf8") + leftover;
        const lines = chunk.split("\n");

        leftover = lines.shift() || "";

        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line) {
            yield line;
          }
        }
      }

      if (leftover.trim()) {
        yield leftover.trim();
      }
    } finally {
      await fd.close();
    }
  }
}

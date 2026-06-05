export interface LogFileReader {
  exists(): Promise<boolean>;
  readLinesFromEnd(): AsyncGenerator<string>;
}

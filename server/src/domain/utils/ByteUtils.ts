const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

export class ByteUtils {
  /** A size people can read in an error message: "740 KB", "12.5 MB", "1.25 GB". */
  public static format(bytes: number): string {
    if (bytes < MB) {
      return `${Math.max(1, Math.round(bytes / KB))} KB`;
    }

    if (bytes < GB) {
      const megabytes = (bytes / MB).toFixed(1).replace(/\.0$/, "");
      return `${megabytes} MB`;
    }

    const gigabytes = (bytes / GB).toFixed(2).replace(/\.?0+$/, "");
    return `${gigabytes} GB`;
  }
}

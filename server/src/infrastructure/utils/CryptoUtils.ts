import { createHash } from "crypto";

export class CryptoUtils {
  public static sha256(value: string): Buffer {
    return createHash("sha256").update(value, "utf8").digest();
  }
}

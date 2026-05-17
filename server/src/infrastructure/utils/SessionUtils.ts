import crypto from "crypto";

export class SessionUtils {
  /**
   * Generate and return secret for session. Check if session exists before using
   * generateSecret method
   * @param length secret length
   */
  public static async generateSecret(length: number) {
    return crypto.randomBytes(length).toString("base64").slice(0, length);
  }
}

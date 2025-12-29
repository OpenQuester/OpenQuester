export class PasswordUtils {
  /**
   * Generates a random password consisting of 4 characters from A-Za-z
   * @returns A 4-character random password
   */
  public static generatePassword(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let password = "";
    for (let i = 0; i < 4; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

import {
  GAME_PASSWORD_CHARACTERS,
  GAME_PASSWORD_LENGTH,
} from "domain/constants/game";

export class PasswordUtils {
  /**
   * Generates a random password consisting of 4 characters from A-Za-z0-9-_
   * @returns A 4-character random password
   */
  public static generateGamePassword(): string {
    let password = "";
    for (let i = 0; i < GAME_PASSWORD_LENGTH; i++) {
      password += GAME_PASSWORD_CHARACTERS.charAt(
        Math.floor(Math.random() * GAME_PASSWORD_CHARACTERS.length)
      );
    }
    return password;
  }
}

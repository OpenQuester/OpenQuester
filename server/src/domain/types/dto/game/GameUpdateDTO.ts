import { AgeRestriction } from "domain/enums/game/AgeRestriction";

export interface GameUpdateDTO {
  title?: string;
  isPrivate?: boolean;
  /**
   * Password for private games.
   * - If game becomes private and password is omitted, server may auto-generate.
   * - If game becomes public, password is cleared regardless of this value.
   */
  password?: string | null;
  ageRestriction?: AgeRestriction;
  maxPlayers?: number;
  /** Only allowed before game start */
  packageId?: number;
}

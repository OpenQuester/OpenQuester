import { AgeRestriction } from "domain/enums/game/AgeRestriction";

export interface GameCreateDTO {
  title: string;
  packageId: number;
  isPrivate: boolean;
  ageRestriction: AgeRestriction;
  maxPlayers: number;
  password?: string;
}

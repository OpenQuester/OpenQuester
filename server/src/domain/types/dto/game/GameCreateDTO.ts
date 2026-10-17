import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import type { GameSettingsInput } from "domain/types/dto/game/settings/GameSettingsDTO";

export interface GameCreateDTO {
  title: string;
  packageId: number;
  isPrivate: boolean;
  ageRestriction: AgeRestriction;
  maxPlayers: number;
  password?: string;
  settings?: GameSettingsInput;
}

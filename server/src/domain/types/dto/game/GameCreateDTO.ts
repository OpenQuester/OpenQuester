import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { GameSettingsDTO } from "domain/types/dto/game/settings/GameSettingsDTO";

export interface GameCreateDTO {
  title: string;
  packageId: number;
  isPrivate: boolean;
  ageRestriction: AgeRestriction;
  maxPlayers: number;
  password?: string;
  settings?: Partial<GameSettingsDTO>;
}

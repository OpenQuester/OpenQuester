import { GameSettingsDTO } from "domain/types/dto/game/settings/GameSettingsDTO";

export interface GameJoinMeta {
  title: string;
  settings: GameSettingsDTO;
}

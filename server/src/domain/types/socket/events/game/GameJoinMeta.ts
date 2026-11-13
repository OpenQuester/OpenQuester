import type { GameSettingsDTO } from "domain/types/dto/game/settings/GameSettingsDTO";

export interface GameJoinMeta {
  maxPlayers?: number;
  title: string;
  settings: GameSettingsDTO;
}

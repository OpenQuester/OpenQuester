import { GameStateThemeDTO } from "domain/types/dto/game/state/GameStateThemeDTO";
import { PackageRoundType } from "domain/types/package/PackageRoundType";

export interface GameStateRoundDTO {
  id: number;
  order: number;
  name: string;
  description: string | null;
  themes: GameStateThemeDTO[];
  type: PackageRoundType;
}

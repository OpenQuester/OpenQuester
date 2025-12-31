import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PackageListItemDTO } from "domain/types/dto/game/items/PackageIListItemDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { ShortUserInfo } from "domain/types/user/ShortUserInfo";

export interface GameListItemPlayersStats {
  id: number;
  role: PlayerRole;
  /**
   * Player's game slot index (0-based).
   * Only set for players with PLAYER role.
   */
  slot: number | null;
}

export interface GameListItemDTO {
  id: string;
  createdBy: ShortUserInfo;
  title: string;
  createdAt: Date;
  currentRound: number | null;
  currentQuestion: number | null;
  isPrivate: boolean;
  ageRestriction: AgeRestriction;
  players: GameListItemPlayersStats[];
  maxPlayers: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  package: PackageListItemDTO;
}

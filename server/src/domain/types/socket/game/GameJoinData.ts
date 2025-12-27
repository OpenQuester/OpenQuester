import { PlayerRole } from "domain/types/game/PlayerRole";

export interface GameJoinData {
  gameId: string;
  role: PlayerRole;
  /**
   * Optional target slot for player role.
   * If not provided, first available slot will be assigned.
   * Only applicable when role is PLAYER.
   */
  targetSlot: number | null;
}

import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { type SocketEventBroadcast } from "domain/types/socket/SocketEventBroadcast";

/**
 * Data returned from game join operation
 */
export interface GameJoinData {
  game: Game;
  player: Player;
}

/**
 * Full result from game join service including broadcasts
 */
export interface GameJoinResult {
  data: GameJoinData;
  broadcasts: SocketEventBroadcast[];
}

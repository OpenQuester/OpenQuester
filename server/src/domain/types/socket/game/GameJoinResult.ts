import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { SocketEventBroadcast } from "domain/handlers/socket/BaseSocketEventHandler";

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

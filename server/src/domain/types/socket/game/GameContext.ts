import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";

/**
 * Encapsulates the complete context for a socket game operation.
 */
export class GameContext {
  constructor(
    public readonly userSession: SocketRedisUserData,
    public readonly game: Game,
    public readonly currentPlayer: Player | null
  ) {
    //
  }
}

import { Game } from "domain/entities/game/Game";
import { GameLobbyLeaveData } from "domain/types/game/GameRoomLeaveData";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";

/**
 * Abstraction for leaving a game lobby. Introduced to decouple UserService
 * from the heavy SocketIOGameService and break circular DI.
 */
export interface IGameLobbyLeaver {
  leaveLobby(
    socketId: string,
    userData: SocketRedisUserData | null,
    game: Game
  ): Promise<GameLobbyLeaveData>;
}

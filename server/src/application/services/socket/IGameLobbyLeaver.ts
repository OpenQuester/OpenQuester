import { GameLobbyLeaveData } from "domain/types/game/GameRoomLeaveData";

/**
 * Abstraction for leaving a game lobby. Introduced to decouple UserService
 * from the heavy SocketIOGameService and break circular DI.
 */
export interface IGameLobbyLeaver {
  leaveLobby(socketId: string): Promise<GameLobbyLeaveData>;
}

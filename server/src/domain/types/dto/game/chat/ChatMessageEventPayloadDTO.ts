import { ChatSystemEntry } from "domain/types/dto/game/chat/ChatSystemEntry";

/**
 * Just ignores gameId field since client already knows the game id
 */
export interface ChatMessageGamePayloadDTO {
  uuid: string;
  user: number;
  timestamp: Date;
  message: string;
  /** Set on lines the server wrote itself (showman action log) */
  system?: ChatSystemEntry;
}

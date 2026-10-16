import { ChatSystemEntry } from "domain/types/dto/game/chat/ChatSystemEntry";

export interface ChatMessageDTO {
  uuid: string;
  gameId: string;
  user: number;
  timestamp: Date;
  message: string;
  system?: ChatSystemEntry;
}

import { ChatSystemEntry } from "domain/types/dto/game/chat/ChatSystemEntry";

export interface ChatSaveInputData {
  user: number;
  gameId: string;
  gameCreatedAt: Date;
  message: string;
  system?: ChatSystemEntry;
}

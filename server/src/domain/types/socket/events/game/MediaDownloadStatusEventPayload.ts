import { GameStateTimerDTO } from "domain/types/dto";

export interface MediaDownloadStatusBroadcastData {
  playerId: number;
  mediaDownloaded: boolean;
  allPlayersReady: boolean;
  timer: GameStateTimerDTO | null;
}

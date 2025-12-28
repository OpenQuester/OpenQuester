import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";

export interface MediaDownloadStatusBroadcastData {
  playerId: number;
  mediaDownloaded: boolean;
  allPlayersReady: boolean;
  timer: GameStateTimerDTO | null;
}

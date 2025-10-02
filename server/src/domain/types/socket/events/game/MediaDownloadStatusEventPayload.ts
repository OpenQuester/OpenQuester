export interface MediaDownloadStatusBroadcastData {
  playerId: number;
  mediaDownloaded: boolean;
  allPlayersReady: boolean;
  timer?: {
    startedAt: Date;
    durationMs: number;
    elapsedMs: number;
  };
}

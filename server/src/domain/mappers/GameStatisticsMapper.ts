import { GameStatisticsData } from "domain/types/statistics/GameStatisticsData";

export class GameStatisticsMapper {
  public static serializeLiveStatistics(data: GameStatisticsData): Record<string, string> {
    return {
      gameId: data.gameId,
      startedAt: data.startedAt ? data.startedAt.getTime().toString() : "",
      finishedAt: data.finishedAt ? data.finishedAt.getTime().toString() : "",
      createdBy: data.createdBy.toString(),
      duration: data.duration !== null ? data.duration.toString() : "",
      totalPlayers: data.totalPlayers !== null ? data.totalPlayers.toString() : "",
      gameMode: data.gameMode !== null ? data.gameMode.toString() : "",
      totalRounds: data.totalRounds !== null ? data.totalRounds.toString() : "",
      totalQuestions: data.totalQuestions !== null ? data.totalQuestions.toString() : ""
    };
  }
}

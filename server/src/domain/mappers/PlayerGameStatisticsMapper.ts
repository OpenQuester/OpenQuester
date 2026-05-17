import {
  PlayerGameStatsRedisData,
  PlayerGameStatsRedisUpdate
} from "domain/types/statistics/PlayerGameStatsRedisData";

export class PlayerGameStatisticsMapper {
  /* Returns `Record<string, string>` structure which satisfies PlayerGameStatsRedisData interface
   *
   * Required to do so since `RedisRepository` expects `Record<string, string>` only
   */
  public static playerStatsInitData(
    gameId: string,
    userId: number,
    joinedAt: Date
  ): Record<string, string> {
    return {
      gameId,
      userId: userId.toString(),
      joinedAt: joinedAt.getTime().toString(),
      leftAt: "",
      currentScore: "0",
      questionsAnswered: "0",
      correctAnswers: "0",
      wrongAnswers: "0"
    } satisfies PlayerGameStatsRedisData;
  }

  public static buildPlayerStatsUpdateData(
    data: PlayerGameStatsRedisUpdate
  ): Record<string, string> {
    const output: Record<string, string> = {};

    if (data.gameId !== undefined) {
      output.gameId = data.gameId;
    }

    if (data.userId !== undefined) {
      output.userId = data.userId;
    }

    if (data.joinedAt !== undefined) {
      output.joinedAt = data.joinedAt;
    }

    if (data.leftAt !== undefined) {
      output.leftAt = data.leftAt ?? "";
    }

    if (data.currentScore !== undefined) {
      output.currentScore = data.currentScore.toString();
    }

    if (data.questionsAnswered !== undefined) {
      output.questionsAnswered = data.questionsAnswered.toString();
    }

    if (data.correctAnswers !== undefined) {
      output.correctAnswers = data.correctAnswers.toString();
    }

    if (data.wrongAnswers !== undefined) {
      output.wrongAnswers = data.wrongAnswers.toString();
    }

    return output;
  }
}

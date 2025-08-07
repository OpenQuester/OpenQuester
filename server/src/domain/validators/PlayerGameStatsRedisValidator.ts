import { PlayerGameStatsRedisData } from "domain/types/statistics/PlayerGameStatsRedisData";
import { playerGameStatsDataScheme } from "presentation/schemes/game/playerSchemes";

export class PlayerGameStatsRedisValidator {
  /**
   * Validate Redis data and return typed result
   * @param data Raw Redis data from hgetall or other source
   * @returns Validated PlayerGameStatsRedisData
   */
  public static validateRedisData(
    data: Record<string, string>
  ): PlayerGameStatsRedisData {
    const { value, error } = playerGameStatsDataScheme().validate(data, {
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      throw new Error(`Invalid PlayerGameStats Redis data: ${error.message}`);
    }

    return value;
  }
}

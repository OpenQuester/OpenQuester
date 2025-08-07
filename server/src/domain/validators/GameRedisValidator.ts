import { GameRedisHashDTO } from "domain/types/dto/game/GameRedisHashDTO";
import { gameRedisDataScheme } from "presentation/schemes/game/gameSchemes";

export class GameRedisValidator {
  /**
   * Validate Redis data and return typed result
   * @param data Raw Redis data from hgetall or other source
   * @returns Validated GameRedisHashDTO
   */
  public static validateRedisData(
    data: Record<string, string>
  ): GameRedisHashDTO {
    const { value, error } = gameRedisDataScheme().validate(data, {
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      throw new Error(`Invalid Game Redis data: ${error.message}`);
    }

    return value;
  }
}

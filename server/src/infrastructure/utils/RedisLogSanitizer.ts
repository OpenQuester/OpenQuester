import { GameRedisHashDTO } from "domain/types/dto/game/GameRedisHashDTO";
import { GameStateThemeDTO } from "domain/types/dto/game/state/GameStateThemeDTO";
import { PlayerGameStatsRedisData } from "domain/types/statistics/PlayerGameStatsRedisData";
import { ValueUtils } from "domain/utils/ValueUtils";

/**
 * Type definitions for Redis log data structures
 */
interface RedisHSetLogData {
  key: string;
  fields: GameRedisHashDTO | PlayerGameStatsRedisData | Record<string, string>;
  expire?: number;
}

interface RedisBaseLogData {
  [key: string]: any; // Allow any additional properties
}

export type RedisLogData = RedisHSetLogData | RedisBaseLogData;

/**
 * Service responsible for sanitizing Redis operation data for logging
 * Removes verbose data while preserving essential debugging information
 */
export class RedisLogSanitizer {
  /**
   * Sanitizes Redis operation data for logging by truncating large fields
   * @param data The Redis operation data to sanitize
   * @returns Sanitized data suitable for logging
   */
  public static sanitize<T extends RedisLogData>(data: T): T {
    if (!data || typeof data !== "object") {
      return data;
    }

    const sanitized = { ...data } as T;

    if (this.isHSetLogData(sanitized)) {
      sanitized.fields = { ...sanitized.fields };

      if (this.hasGameStateField(sanitized.fields)) {
        sanitized.fields.gameState = this.sanitizeGameStateField(sanitized.fields.gameState);
      }
    }

    return sanitized;
  }

  /**
   * Type guard to check if log data contains fields (HSET operation)
   */
  private static isHSetLogData(data: RedisLogData): data is RedisHSetLogData {
    return "fields" in data && typeof data.fields === "object";
  }

  /**
   * Type guard to check if fields contain gameState data
   */
  private static hasGameStateField(fields: any): fields is GameRedisHashDTO {
    return fields && typeof fields === "object" && "gameState" in fields;
  }

  /**
   * Sanitizes gameState field to show compact summary instead of full question arrays
   */
  private static sanitizeGameStateField(gameStateField: string): string {
    if (!ValueUtils.isString(gameStateField)) {
      return gameStateField;
    }

    try {
      const gameStateData = JSON.parse(gameStateField) as Record<string, any>;

      if (this.hasCurrentRoundThemes(gameStateData)) {
        return this.createGameStateSummary(gameStateData, gameStateData);
      }
    } catch {
      // JSON parsing failed, fall through to length check
    }

    if (gameStateField.length > 150) {
      return gameStateField.substring(0, 150) + "...[TRUNCATED]";
    }

    return gameStateField;
  }

  /**
   * Creates a compact, readable summary of gameState data
   */
  private static createGameStateSummary(
    gameStateData: Record<string, any>,
    validatedGameState: Record<string, any>
  ): string {
    const themes = validatedGameState.currentRound.themes;
    const totalQuestions = themes.reduce(
      (sum: number, theme: GameStateThemeDTO) => sum + (theme.questions?.length || 0),
      0
    );

    const roundInfo = gameStateData.currentRound
      ? `Round: ${gameStateData.currentRound.name} (${themes.length} themes, ${totalQuestions} questions)`
      : "No current round";

    const stateInfo = [
      gameStateData.questionState && `state: ${gameStateData.questionState}`,
      gameStateData.isPaused && "PAUSED",
      gameStateData.answeringPlayer && `answering: ${gameStateData.answeringPlayer}`,
      gameStateData.currentTurnPlayerId && `turn: ${gameStateData.currentTurnPlayerId}`
    ]
      .filter(Boolean)
      .join(", ");

    return `{${roundInfo}${stateInfo ? `, ${stateInfo}` : ""}}`;
  }

  private static hasCurrentRoundThemes(gameStateData: Record<string, any>): gameStateData is Record<
    string,
    any
  > & {
    currentRound: { themes: GameStateThemeDTO[] };
  } {
    return Array.isArray(gameStateData.currentRound?.themes);
  }
}

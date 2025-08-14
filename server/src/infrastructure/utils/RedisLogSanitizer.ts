import { GameRedisHashDTO } from "domain/types/dto/game/GameRedisHashDTO";
import { GameStateThemeDTO } from "domain/types/dto/game/state/GameStateThemeDTO";
import { PlayerGameStatsRedisData } from "domain/types/statistics/PlayerGameStatsRedisData";
import { ValueUtils } from "infrastructure/utils/ValueUtils";
import {
  gameStateDataSchema,
  packageDataSchema,
} from "presentation/schemes/log/redisLogSchemes";

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

    // Create a shallow copy to avoid mutating the original
    const sanitized = { ...data } as T;

    // Handle HSET operations with fields containing game data
    if (this.isHSetLogData(sanitized)) {
      // Create a copy of fields to avoid mutation
      sanitized.fields = { ...sanitized.fields };

      // Handle package field truncation
      if (this.hasPackageField(sanitized.fields)) {
        sanitized.fields.package = this.sanitizePackageField(
          sanitized.fields.package
        );
      }

      // Handle gameState field truncation
      if (this.hasGameStateField(sanitized.fields)) {
        sanitized.fields.gameState = this.sanitizeGameStateField(
          sanitized.fields.gameState
        );
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
   * Type guard to check if fields contain package data
   */
  private static hasPackageField(fields: any): fields is GameRedisHashDTO {
    return fields && typeof fields === "object" && "package" in fields;
  }

  /**
   * Type guard to check if fields contain gameState data
   */
  private static hasGameStateField(fields: any): fields is GameRedisHashDTO {
    return fields && typeof fields === "object" && "gameState" in fields;
  }

  /**
   * Sanitizes package field to show only ID
   */
  private static sanitizePackageField(packageField: string): string {
    if (!ValueUtils.isString(packageField)) {
      return packageField;
    }

    try {
      const packageData = JSON.parse(packageField);
      const { value: validatedPackage, error } =
        packageDataSchema().validate(packageData);

      if (!error && validatedPackage?.id) {
        return `{id: ${validatedPackage.id}, ...}`;
      }
    } catch {
      // JSON parsing failed, fall through to length check
    }

    // Fallback: truncate if too long
    if (packageField.length > 75) {
      return packageField.substring(0, 75) + "...";
    }

    return packageField;
  }

  /**
   * Sanitizes gameState field to show compact summary instead of full question arrays
   */
  private static sanitizeGameStateField(gameStateField: string): string {
    if (!ValueUtils.isString(gameStateField)) {
      return gameStateField;
    }

    try {
      const gameStateData = JSON.parse(gameStateField);
      const { value: validatedGameState, error } =
        gameStateDataSchema().validate(gameStateData);

      if (!error && validatedGameState?.currentRound?.themes) {
        return this.createGameStateSummary(gameStateData, validatedGameState);
      }
    } catch {
      // JSON parsing failed, fall through to length check
    }

    // Fallback: truncate if too long
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
      (sum: number, theme: GameStateThemeDTO) =>
        sum + (theme.questions?.length || 0),
      0
    );

    // Create a very compact summary focusing on essential info
    const roundInfo = gameStateData.currentRound
      ? `Round: ${gameStateData.currentRound.name} (${themes.length} themes, ${totalQuestions} questions)`
      : "No current round";

    const stateInfo = [
      gameStateData.questionState && `state: ${gameStateData.questionState}`,
      gameStateData.isPaused && "PAUSED",
      gameStateData.answeringPlayer &&
        `answering: ${gameStateData.answeringPlayer}`,
      gameStateData.currentTurnPlayerId &&
        `turn: ${gameStateData.currentTurnPlayerId}`,
    ]
      .filter(Boolean)
      .join(", ");

    return `{${roundInfo}${stateInfo ? `, ${stateInfo}` : ""}}`;
  }
}

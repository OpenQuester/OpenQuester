import { GameMode } from "domain/enums/GameMode";

/**
 * Game statistics data interface for temporary storage and persistence
 */
export interface GameStatisticsData {
  gameId: string;
  startedAt: Date;
  finishedAt: Date | null;
  createdBy: number;
  duration: number | null; // Duration in milliseconds
  totalPlayers: number | null;
  gameMode: GameMode | null;
  totalRounds: number | null;
  totalQuestions: number | null;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

import { GameMode } from "domain/enums/GameMode";
import { GameStatisticsData } from "domain/types/statistics/GameStatisticsData";

@Entity("game_statistics")
export class GameStatistics {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", nullable: false })
  game_id!: string;

  @Column({ type: "timestamp", nullable: false })
  started_at!: Date;

  @Column({ type: "timestamp", nullable: false })
  finished_at!: Date;

  @Column({ type: "int", nullable: false })
  created_by!: number;

  @Column({ type: "int", nullable: false })
  duration!: number;

  @Column({ type: "int", nullable: true })
  total_players!: number | null;

  @Column({
    type: "enum",
    enum: GameMode,
    nullable: true,
    default: GameMode.DEFAULT,
  })
  game_mode!: GameMode | null;

  @Column({ type: "int", nullable: true })
  total_rounds!: number | null;

  @Column({ type: "int", nullable: true })
  total_questions!: number | null;

  @CreateDateColumn()
  created_at!: Date;

  /**
   * Import data from GameStatisticsData interface
   */
  public import(data: GameStatisticsData): void {
    this.game_id = data.gameId;
    this.started_at = data.startedAt;
    this.finished_at = data.finishedAt!;
    this.created_by = data.createdBy;
    this.duration = data.duration!;
    this.total_players = data.totalPlayers;
    this.game_mode = data.gameMode ?? GameMode.DEFAULT;
    this.total_rounds = data.totalRounds;
    this.total_questions = data.totalQuestions;
  }

  /**
   * Convert to GameStatisticsData interface
   */
  public toData(): GameStatisticsData {
    return {
      gameId: this.game_id,
      startedAt: this.started_at,
      finishedAt: this.finished_at,
      createdBy: this.created_by,
      duration: this.duration,
      totalPlayers: this.total_players ?? null,
      gameMode: this.game_mode ?? null,
      totalRounds: this.total_rounds ?? null,
      totalQuestions: this.total_questions ?? null,
    };
  }
}

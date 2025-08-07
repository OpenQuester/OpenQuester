import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { PlayerGameStatsData } from "domain/types/statistics/PlayerGameStatsData";
import { User } from "infrastructure/database/models/User";

import { GameStatistics } from "./GameStatistics";

@Entity("player_game_stats")
export class PlayerGameStats {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", nullable: false })
  game_stats_id!: number;

  @Column({ type: "int", nullable: false })
  user_id!: number;

  @Column({ type: "int", nullable: false, default: 0 })
  final_score!: number;

  @Column({ type: "int", nullable: true })
  placement?: number | null;

  @Column({ type: "timestamp", nullable: false })
  joined_at!: Date;

  @Column({ type: "timestamp", nullable: true })
  left_at?: Date | null;

  @Column({ type: "int", nullable: false, default: 0 })
  questions_answered!: number;

  @Column({ type: "int", nullable: false, default: 0 })
  correct_answers!: number;

  @Column({ type: "int", nullable: false, default: 0 })
  wrong_answers!: number;

  @CreateDateColumn()
  created_at!: Date;

  // Relations
  @ManyToOne(() => GameStatistics, { onDelete: "CASCADE" })
  @JoinColumn({ name: "game_stats_id" })
  gameStats!: GameStatistics;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  /**
   * Import data from PlayerGameStatsData interface
   */
  public import(data: PlayerGameStatsData): void {
    this.game_stats_id = data.gameStatsId;
    this.user_id = data.userId;
    this.final_score = data.finalScore;
    this.placement = data.placement;
    this.joined_at = data.joinedAt;
    this.left_at = data.leftAt;
    this.questions_answered = data.questionsAnswered;
    this.correct_answers = data.correctAnswers;
    this.wrong_answers = data.wrongAnswers;
  }

  /**
   * Convert to PlayerGameStatsData interface
   */
  public toData(): PlayerGameStatsData {
    return {
      gameStatsId: this.game_stats_id,
      userId: this.user_id,
      finalScore: this.final_score,
      placement: this.placement ?? null,
      joinedAt: this.joined_at,
      leftAt: this.left_at ?? null,
      questionsAnswered: this.questions_answered,
      correctAnswers: this.correct_answers,
      wrongAnswers: this.wrong_answers,
    };
  }
}

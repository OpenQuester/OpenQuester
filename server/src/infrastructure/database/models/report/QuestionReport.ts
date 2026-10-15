import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";

import { QuestionReportReason } from "domain/types/dto/report/QuestionReportDTO";
import { Package } from "infrastructure/database/models/package/Package";
import { User } from "infrastructure/database/models/User";

/**
 * A player's note that a question is wrong or broken. The question id is not a
 * foreign key: editing a package recreates its questions, and the report (with
 * its text snapshot) should outlive that.
 */
@Entity("question_report")
@Index(["package_id", "resolved"])
export class QuestionReport {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  package_id!: number;

  @Column({ type: "int" })
  question_id!: number;

  @Column({ type: "text", nullable: true })
  question_text!: string | null;

  @Column({ type: "int", nullable: true })
  user_id!: number | null;

  @Column({ type: "varchar", nullable: true })
  game_id!: string | null;

  @Column({ type: "varchar", length: 32 })
  reason!: QuestionReportReason;

  @Column({ type: "text", nullable: true })
  comment!: string | null;

  @Column({ type: "boolean", default: false })
  resolved!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => Package, { onDelete: "CASCADE" })
  @JoinColumn({ name: "package_id" })
  package!: Package;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "user_id" })
  user!: User | null;
}

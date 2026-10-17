import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

import { StorageGroup } from "domain/types/storage/StorageTypes";

/** Postgres bigint arrives as a string; limits fit comfortably in a JS number. */
export const bigintNumber = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value))
};

/** Storage limits for one group of users. Null means no limit. */
@Entity("storage_limit")
export class StorageLimit {
  @PrimaryColumn({ type: "varchar", length: 16 })
  group!: StorageGroup;

  @Column({ type: "bigint", nullable: true, transformer: bigintNumber })
  user_quota_bytes!: number | null;

  @Column({ type: "bigint", nullable: true, transformer: bigintNumber })
  package_bytes!: number | null;

  @Column({ type: "bigint", nullable: true, transformer: bigintNumber })
  image_bytes!: number | null;

  @Column({ type: "bigint", nullable: true, transformer: bigintNumber })
  audio_bytes!: number | null;

  @Column({ type: "bigint", nullable: true, transformer: bigintNumber })
  video_bytes!: number | null;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updated_at!: Date;
}

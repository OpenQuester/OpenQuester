import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

import { FileSource } from "domain/enums/file/FileSource";
import { FileDTO } from "domain/types/dto/file/FileDTO";
import { FileModel } from "domain/types/file/FileModel";
import { bigintNumber } from "infrastructure/database/models/StorageLimit";

@Entity("file")
export class File implements FileModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  path!: string;

  @Column({
    type: "enum",
    enum: FileSource,
    enumName: "file_source_enum",
  })
  source!: FileSource;

  @Column()
  filename!: string;

  @Column()
  created_at!: Date;

  /** Bytes: declared by the uploader, then confirmed from storage. */
  @Column({ type: "bigint", nullable: true, transformer: bigintNumber })
  size!: number | null;

  /** When `size` was read from storage rather than taken from the uploader. */
  @Column({ type: "timestamp with time zone", nullable: true })
  size_verified_at!: Date | null;

  public import(data: FileDTO) {
    this.path = data.path;
    this.filename = data.filename;
    this.source = data.source;
    this.created_at = data.created_at;
  }

  public toDTO(): FileDTO {
    return {
      created_at: this.created_at,
      filename: this.filename,
      path: this.path,
      source: this.source,
    };
  }
}

import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";

import { ClientResponse } from "domain/enums/ClientResponse";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { ClientError } from "domain/errors/ClientError";
import { PackageDTOOptions } from "domain/types/dto/package/options/PackageDTOOptions";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PackageImport } from "domain/types/package/import/PackageImport";
import { File } from "infrastructure/database/models/File";
import { PackageRound } from "infrastructure/database/models/package/PackageRound";
import { PackageTag } from "infrastructure/database/models/package/PackageTag";
import { User } from "infrastructure/database/models/User";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";

@Entity("package")
export class Package {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: false })
  title!: string;

  @Column({ nullable: false })
  created_at!: Date;

  @ManyToOne(() => User, (user) => user.packages, {
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn({ name: "author" })
  author!: User;

  @Column({ type: "varchar", nullable: true })
  language?: string | null;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @Column({ type: "enum", enum: AgeRestriction, default: AgeRestriction.NONE })
  age_restriction!: AgeRestriction;

  @ManyToOne(() => File, { nullable: true })
  @JoinColumn({ name: "logo_file" })
  logo?: File | null;

  // Relationships
  @OneToMany(() => PackageRound, (round: PackageRound) => round.package)
  rounds!: PackageRound[];

  @ManyToMany(() => PackageTag, (tag) => tag.packages, { cascade: true })
  @JoinTable({
    name: "packages_tags",
    joinColumn: { name: "package", referencedColumnName: "id" },
    inverseJoinColumn: { name: "tag", referencedColumnName: "id" },
  })
  tags!: PackageTag[];

  // Virtual properties for counts (not persisted to the database)
  roundCount?: number;

  questionCount?: number;

  public import(data: PackageImport) {
    this.title = data.title;
    this.created_at = data.createdAt;
    this.language = data.language;
    this.description = data.description;
    this.age_restriction = data.ageRestriction;
    this.author = data.author;
    this.tags = data.tags;

    if (data.logo) {
      this.logo = data.logo;
    }
  }

  public logoDTO(storage: S3StorageService, opts?: PackageDTOOptions) {
    const options = opts ?? { fetchIds: false };
    const dto = this.logo
      ? {
          file: {
            id: this.logo.id,
            md5: this.logo.filename,
            type: PackageFileType.IMAGE,
            link: storage.getUrl(this.logo.filename),
          },
        }
      : null;

    if (options.fetchIds && this.logo) {
      dto!.file.id = this.logo.id;
    }

    return dto;
  }

  public toSimpleDTO(storage: S3StorageService): Omit<PackageDTO, "rounds"> {
    return {
      id: this.id,
      title: this.title,
      ageRestriction: this.age_restriction,
      author: {
        id: this.author.id,
        username: this.author.username,
      },
      createdAt: this.created_at,
      description: this.description,
      language: this.language,
      logo: this.logoDTO(storage),
      tags: this.tags.map((tag) => tag.toDTO()),
    };
  }

  public toDTO(
    storage: S3StorageService,
    opts?: PackageDTOOptions
  ): PackageDTO {
    const options = opts ?? { fetchIds: false };

    const logoDTO = this.logoDTO(storage);

    if (!this.rounds) {
      throw new ClientError(ClientResponse.PACKAGE_CORRUPTED, undefined, {
        id: this.id,
        missing: "rounds:notLoaded",
      });
    }
    if (this.rounds.length < 1) {
      throw new ClientError(ClientResponse.PACKAGE_CORRUPTED, undefined, {
        id: this.id,
        missing: "rounds",
      });
    }

    const roundsDTO = this.rounds
      .sort((a, b) => a.order - b.order)
      .map((round) => round.toDTO(storage, options));

    const tagsDTO = this.tags.map((tag) => tag.toDTO());

    let dto: PackageDTO = {
      title: this.title,
      ageRestriction: this.age_restriction,
      author: {
        id: this.author.id,
        username: this.author.username,
      },
      createdAt: this.created_at,
      description: this.description,
      language: this.language,
      logo: logoDTO,
      rounds: roundsDTO,
      tags: tagsDTO,
    };

    if (options.fetchIds) {
      dto = {
        id: this.id,
        ...dto,
      };
    }

    return dto;
  }
}

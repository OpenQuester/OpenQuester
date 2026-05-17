import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";

import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PackageDTOOptions } from "domain/types/dto/package/options/PackageDTOOptions";
import { PackageThemeDTO } from "domain/types/dto/package/PackageThemeDTO";
import { type IFileUrlBuilder } from "domain/types/storage/IFileUrlBuilder";
import { PackageQuestion } from "infrastructure/database/models/package/PackageQuestion";
import { PackageRound } from "infrastructure/database/models/package/PackageRound";

export interface PackageThemeImport {
  name: string;
  description?: string | null;
  round: PackageRound;
  order: number;
}

@Entity("package_theme")
export class PackageTheme {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => PackageRound, (round) => round.themes, {
    onDelete: "CASCADE"
  })
  @JoinColumn({ name: "round" })
  round!: PackageRound;

  @Column()
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @OneToMany(() => PackageQuestion, (question: PackageQuestion) => question.theme)
  questions!: PackageQuestion[];

  @Column({ type: "int" })
  order!: number;

  public import(data: PackageThemeImport) {
    this.name = data.name;
    this.description = data.description;
    this.round = data.round;
    this.order = data.order;
  }

  public toDTO(fileUrlBuilder: IFileUrlBuilder, opts: PackageDTOOptions): PackageThemeDTO {
    if (this.questions.length < 1) {
      throw new ClientError(ClientResponse.PACKAGE_CORRUPTED, undefined, {
        id: this.id,
        missing: "questions"
      });
    }

    const questionsDTO = this.questions.map((question) => question.toDTO(fileUrlBuilder, opts));

    let dto: PackageThemeDTO = {
      id: this.id,
      order: this.order,
      name: this.name,
      description: this.description,
      questions: questionsDTO
    };

    if (opts.fetchIds) {
      dto = {
        id: this.id,
        ...dto
      };
    }

    return dto;
  }
}

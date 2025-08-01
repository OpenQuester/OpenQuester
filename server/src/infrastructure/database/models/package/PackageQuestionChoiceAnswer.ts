import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { PackageFileType } from "domain/enums/package/PackageFileType";
import { PackageDTOOptions } from "domain/types/dto/package/options/PackageDTOOptions";
import { PackageAnswerDTO } from "domain/types/dto/package/PackageAnswerDTO";
import { PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";
import { PackageQuestionChoiceAnswerImport } from "domain/types/package/import/PackageQuestionChoiceAnswerImport";
import { File } from "infrastructure/database/models/File";
import { PackageQuestion } from "infrastructure/database/models/package/PackageQuestion";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";

@Entity("package_question_choice_answer")
export class PackageQuestionChoiceAnswer {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => PackageQuestion, (question) => question.answers, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "question" })
  question!: PackageQuestion;

  @Column({ type: "int" })
  order!: number;

  @Column({ type: "text", nullable: true })
  text?: string | null;

  @ManyToOne(() => File, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "file" })
  file?: File | null;

  @Column({ type: "enum", enum: PackageFileType, nullable: true })
  type?: PackageFileType | null;

  public import(data: PackageQuestionChoiceAnswerImport) {
    this.text = data.text;
    this.order = data.order;
    this.file = data.fileData?.file;
    this.type = data.fileData?.type;
    this.question = data.question;
  }

  public toDTO(
    storage: S3StorageService,
    opts: PackageDTOOptions
  ): PackageAnswerDTO {
    const fileDTO: PackageFileDTO | null = this.file
      ? {
          md5: this.file.filename,
          type: this.type!,
          link: storage.getUrl(this.file.filename),
        }
      : null;

    if (opts.fetchIds && this.file) {
      fileDTO!.id = this.file.id;
    }

    let dto: PackageAnswerDTO = {
      text: this.text,
      file: fileDTO,
      order: this.order,
    };

    if (opts.fetchIds) {
      dto = {
        id: this.id,
        ...dto,
      };
    }

    return dto;
  }
}

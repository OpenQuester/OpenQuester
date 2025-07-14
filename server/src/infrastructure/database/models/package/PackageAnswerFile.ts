import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { PackageFileType } from "domain/enums/package/PackageFileType";
import { PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";
import { PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";
import { PackageDTOOptions } from "domain/types/dto/package/options/PackageDTOOptions";
import { PackageAnswerFileImport } from "domain/types/package/import/PackageAnswerFileImport";
import { File } from "infrastructure/database/models/File";
import { PackageQuestion } from "infrastructure/database/models/package/PackageQuestion";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";

@Entity("package_answer_file")
export class PackageAnswerFile {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => PackageQuestion, (question) => question.answerFiles, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "question" })
  question!: PackageQuestion;

  @Column({ type: "int" })
  order!: number;

  @ManyToOne(() => File, { onDelete: "CASCADE" })
  @JoinColumn({ name: "file" })
  file!: File;

  @Column({ type: "enum", enum: PackageFileType })
  type!: PackageFileType;

  @Column({ type: "int", nullable: true })
  display_time!: number | null;

  public import(data: PackageAnswerFileImport) {
    this.file = data.file;
    this.order = data.order;
    this.type = data.type;
    this.display_time = data.display_time;
    this.question = data.question;
  }

  public toDTO(
    storage: S3StorageService,
    opts: PackageDTOOptions
  ): PackageQuestionFileDTO {
    const fileDTO: PackageFileDTO = {
      md5: this.file.filename,
      type: this.type,
      link: storage.getUrl(this.file.filename),
    };

    if (opts.fetchIds) {
      fileDTO.id = this.file.id;
    }

    return {
      file: fileDTO,
      order: this.order,
      displayTime: this.display_time,
    };
  }
}

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { ContentPlacement } from "domain/enums/package/ContentPlacement";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { PackageDTOOptions } from "domain/types/dto/package/options/PackageDTOOptions";
import { PackageFileDTO } from "domain/types/dto/package/PackageFileDTO";
import { PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";
import { type IFileUrlBuilder } from "domain/types/storage/IFileUrlBuilder";
import { File } from "infrastructure/database/models/File";
import { PackageQuestion } from "infrastructure/database/models/package/PackageQuestion";

export interface PackageQuestionFileImport {
  file: File;
  order: number;
  type: PackageFileType;
  display_time: number | null;
  placement?: ContentPlacement | null;
  wait_for_finish?: boolean | null;
  question: PackageQuestion;
}

@Entity("package_question_file")
export class PackageQuestionFile {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => PackageQuestion, (question) => question.questionFiles, {
    onDelete: "CASCADE"
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

  @Column({ type: "varchar", length: 16, default: ContentPlacement.SCREEN })
  placement!: ContentPlacement;

  @Column({ type: "boolean", default: true })
  wait_for_finish!: boolean;

  public import(data: PackageQuestionFileImport) {
    this.file = data.file;
    this.order = data.order;
    this.type = data.type;
    this.display_time = data.display_time;
    this.placement = data.placement ?? ContentPlacement.SCREEN;
    this.wait_for_finish = data.wait_for_finish ?? true;
    this.question = data.question;
  }

  public toDTO(fileUrlBuilder: IFileUrlBuilder, opts: PackageDTOOptions): PackageQuestionFileDTO {
    const fileDTO: PackageFileDTO = {
      md5: this.file.filename,
      type: this.type,
      link: fileUrlBuilder.getUrl(this.file.filename)
    };

    if (opts.fetchIds) {
      fileDTO.id = this.file.id;
    }

    return {
      file: fileDTO,
      displayTime: this.display_time,
      order: this.order,
      placement: this.placement,
      waitForFinish: this.wait_for_finish
    };
  }
}

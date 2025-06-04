import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";

import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageDTOOptions } from "domain/types/dto/package/options/PackageDTOOptions";
import {
  PackageQuestionDTO,
  PackageQuestionSubType,
} from "domain/types/dto/package/PackageQuestionDTO";
import { PackageQuestionImport } from "domain/types/package/import/PackageQuestionImport";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { PackageAnswerFile } from "infrastructure/database/models/package/PackageAnswerFile";
import { PackageQuestionChoiceAnswer } from "infrastructure/database/models/package/PackageQuestionChoiceAnswer";
import { PackageQuestionFile } from "infrastructure/database/models/package/PackageQuestionFile";
import { PackageTheme } from "infrastructure/database/models/package/PackageTheme";
import { S3StorageService } from "infrastructure/services/storage/S3StorageService";

@Entity("package_question")
export class PackageQuestion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  order!: number;

  @ManyToOne(() => PackageTheme, (theme) => theme.questions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "theme" })
  theme!: PackageTheme;

  @Column()
  price!: number;

  @Column({
    type: "enum",
    enum: ["simple", "stake", "secret", "noRisk", "hidden", "choice"],
  })
  type!: PackageQuestionType;

  @Column({ name: "is_hidden", default: false })
  isHidden!: boolean;

  @Column({ type: "text", nullable: true })
  text?: string | null;

  @Column({ type: "text", nullable: true })
  answer_hint?: string | null;

  @Column({ type: "text", nullable: true })
  answer_text?: string | null;

  @Column({ type: "int", nullable: true })
  answer_delay?: number | null;

  @Column({ type: "text", nullable: true })
  question_comment?: string | null;

  @OneToMany(
    () => PackageQuestionFile,
    (file: PackageQuestionFile) => file.question
  )
  questionFiles?: PackageQuestionFile[] | null;

  @OneToMany(
    () => PackageAnswerFile,
    (file: PackageAnswerFile) => file.question
  )
  answerFiles?: PackageAnswerFile[] | null;

  @Column({ type: "varchar", nullable: true })
  sub_type?: PackageQuestionSubType | null;

  @Column({ type: "int", nullable: true })
  max_price?: number | null;

  @Column("int", { array: true, nullable: true })
  allowed_prices?: number[] | null;

  @Column({ type: "enum", enum: ["any", "exceptCurrent"], nullable: true })
  transfer_type?: PackageQuestionTransferType | null;

  @Column({ type: "decimal", precision: 6, scale: 3, nullable: true })
  price_multiplier?: number | null;

  @Column({ name: "show_delay", type: "int", nullable: true })
  showDelay?: number | null;

  @OneToMany(
    () => PackageQuestionChoiceAnswer,
    (answer: PackageQuestionChoiceAnswer) => answer.question
  )
  answers?: PackageQuestionChoiceAnswer[] | null;

  public import(data: PackageQuestionImport) {
    this.theme = data.theme;
    this.order = data.order;
    this.price = data.price;
    this.type = data.type;
    this.isHidden = data.isHidden;
    this.text = data.text;
    this.answer_hint = data.answerHint;
    this.answer_text = data.answerText;
    this.answer_delay = data.answerDelay;
    this.question_comment = data.questionComment;
    this.sub_type = data.subType;
    this.max_price = data.maxPrice;
    this.allowed_prices = data.allowedPrices;
    this.transfer_type = data.transferType;
    this.price_multiplier = data.priceMultiplier;
    this.showDelay = data.showDelay;
  }

  public toDTO(
    storage: S3StorageService,
    opts: PackageDTOOptions
  ): PackageQuestionDTO {
    const questionFilesDTO =
      this.questionFiles && this.questionFiles.length > 0
        ? this.questionFiles.map((file) => file.toDTO(storage, opts))
        : null;

    const answerFilesDTO =
      this.answerFiles && this.answerFiles.length > 0
        ? this.answerFiles.map((file) => file.toDTO(storage, opts))
        : null;

    const answersDTO =
      this.answers && this.answers.length > 0
        ? this.answers.map((answer) => answer.toDTO(storage, opts))
        : null;

    let dto: PackageQuestionDTO = {
      type: this.type,
      order: this.order,
      price: this.price,
      isHidden: this.isHidden,
      text: this.text,
      answerHint: this.answer_hint,
      answerText: this.answer_text,
      answerDelay: this.answer_delay ?? 5000,
      questionComment: this.question_comment,
      questionFiles: questionFilesDTO,
      answerFiles: answerFilesDTO,
      subType: this.sub_type ?? PackageQuestionSubType.SIMPLE,
      maxPrice: this.max_price,
      allowedPrices: this.allowed_prices,
      transferType: this.transfer_type,
      priceMultiplier: this.price_multiplier,
      showDelay: this.showDelay,
      answers: answersDTO,
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

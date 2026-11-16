import { getRealPrice, getVisiblePrice } from "domain/logic/question/questionPrices";
import { answerFormat } from "domain/logic/question/answerFormat";
import type { SecretRules } from "domain/types/package/SecretRules";
import type { QuestionScriptDTO } from "domain/types/dto/package/QuestionScriptDTO";
import { nonEmpty } from "domain/utils/textList";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";

import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageDTOOptions } from "domain/types/dto/package/options/PackageDTOOptions";
import { AnswerType } from "domain/enums/package/AnswerType";
import {
  AnswerPointDTO,
  PackageQuestionDTO,
  PackageQuestionSubType,
  QuestionTextItemDTO
} from "domain/types/dto/package/PackageQuestionDTO";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { type IFileUrlBuilder } from "domain/types/storage/IFileUrlBuilder";
import { PackageAnswerFile } from "infrastructure/database/models/package/PackageAnswerFile";
import { PackageQuestionChoiceAnswer } from "infrastructure/database/models/package/PackageQuestionChoiceAnswer";
import { PackageQuestionFile } from "infrastructure/database/models/package/PackageQuestionFile";
import { PackageTheme } from "infrastructure/database/models/package/PackageTheme";

export interface PackageQuestionImport {
  script?: QuestionScriptDTO | null;
  theme: PackageTheme;
  order: number;
  secretRules?: SecretRules | null;
  price: number | null; // Final round questions have null price - players bid after theme selection
  realPrice?: number | null;
  type: PackageQuestionType;
  isHidden: boolean;
  text?: string | null;
  textOrder?: number | null;
  textItems?: QuestionTextItemDTO[] | null;
  textDurationMs?: number | null;
  textWaitForFinish?: boolean | null;
  answerDurationMs?: number | null;
  answerTextItems?: QuestionTextItemDTO[] | null;
  showmanComments?: string | null;
  answerExplanation?: string | null;
  playMediaSimultaneously?: boolean | null;
  answerHint?: string | null;
  answerText?: string | null;
  answerType?: AnswerType | null;
  answerNumber?: number | null;
  answerPoint?: AnswerPointDTO | null;
  pointImageOrder?: number | null;
  answerDeviation?: number | null;
  rightAnswers?: string[] | null;
  wrongAnswers?: string[] | null;
  authors?: string[] | null;
  sources?: string[] | null;
  answerDelay?: number | null;
  questionComment?: string | null;
  subType?: PackageQuestionSubType | null;
  maxPrice?: number | null;
  allowedPrices?: number[] | null;
  transferType?: PackageQuestionTransferType | null;
  priceMultiplier?: number | null;
  showDelay?: number | null;
  correctChoiceOrder?: number | null;
  selectSource?: PackageQuestionDTO["selectSource"];
  showAnswerDuration: number;
}

@Entity("package_question")
export class PackageQuestion {
  @Column({ name: "script", type: "jsonb", nullable: true })
  script?: QuestionScriptDTO | null;
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  order!: number;

  @ManyToOne(() => PackageTheme, (theme) => theme.questions, {
    onDelete: "CASCADE"
  })
  @JoinColumn({ name: "theme" })
  theme!: PackageTheme;

  @Column({ type: "int", nullable: true }) // Final round questions have null price - players bid after theme selection
  price!: number | null;

  @Column({ name: "real_price", type: "int", nullable: true })
  realPrice?: number | null;

  @Column({ name: "secret_rules", type: "jsonb", nullable: true })
  secret_rules?: SecretRules | null;

  @Column({ type: "int", default: 5000 })
  show_answer_duration!: number;

  @Column({
    type: "enum",
    enum: ["simple", "stake", "secret", "noRisk", "hidden", "choice"]
  })
  type!: PackageQuestionType;

  @Column({ name: "is_hidden", default: false })
  isHidden!: boolean;

  @Column({ type: "text", nullable: true })
  text?: string | null;

  /** Position of the text in the content order; null shows it as a caption */
  @Column({ name: "text_order", type: "int", nullable: true })
  text_order?: number | null;

  @Column({ name: "text_items", type: "jsonb", nullable: true })
  text_items?: QuestionTextItemDTO[] | null;

  @Column({ type: "int", nullable: true })
  text_duration_ms?: number | null;

  @Column({ type: "boolean", nullable: true })
  text_wait_for_finish?: boolean | null;

  @Column({ type: "int", nullable: true })
  answer_duration_ms?: number | null;

  @Column({ type: "jsonb", nullable: true })
  answer_text_items?: QuestionTextItemDTO[] | null;

  @Column({ type: "text", nullable: true })
  showman_comments?: string | null;

  @Column({ type: "text", nullable: true })
  answer_explanation?: string | null;

  @Column({ type: "boolean", default: true })
  play_media_simultaneously!: boolean;

  @Column({ type: "text", nullable: true })
  answer_hint?: string | null;

  @Column({ type: "text", nullable: true })
  answer_text?: string | null;

  @Column({ type: "varchar", length: 16, nullable: true })
  answer_type?: AnswerType | null;

  @Column({ type: "double precision", nullable: true })
  answer_number?: number | null;

  @Column({ type: "jsonb", nullable: true })
  answer_point?: AnswerPointDTO | null;

  @Column({ name: "point_image_order", type: "int", nullable: true })
  point_image_order?: number | null;

  @Column({ type: "double precision", nullable: true })
  answer_deviation?: number | null;

  @Column({ type: "text", array: true, nullable: true })
  right_answers?: string[] | null;

  @Column({ type: "text", array: true, nullable: true })
  wrong_answers?: string[] | null;

  @Column({ type: "text", array: true, nullable: true })
  authors?: string[] | null;

  @Column({ type: "text", array: true, nullable: true })
  sources?: string[] | null;

  @Column({ type: "int", nullable: true })
  answer_delay?: number | null;

  @Column({ type: "text", nullable: true })
  question_comment?: string | null;

  @OneToMany(() => PackageQuestionFile, (file: PackageQuestionFile) => file.question)
  questionFiles?: PackageQuestionFile[] | null;

  @OneToMany(() => PackageAnswerFile, (file: PackageAnswerFile) => file.question)
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

  @Column({ name: "correct_choice_order", type: "int", nullable: true })
  correctChoiceOrder?: number | null;

  @Column({ type: "text", array: true, nullable: true })
  select_source_right_labels?: string[] | null;

  @OneToMany(
    () => PackageQuestionChoiceAnswer,
    (answer: PackageQuestionChoiceAnswer) => answer.question
  )
  answers?: PackageQuestionChoiceAnswer[] | null;

  public getVisiblePrice(): number | null {
    return getVisiblePrice(this);
  }

  public getRealPrice(): number | null {
    return getRealPrice(this);
  }

  public import(data: PackageQuestionImport) {
    this.script = data.script ?? null;
    this.theme = data.theme;
    this.order = data.order;
    this.price = data.price;
    this.realPrice = data.realPrice ?? null;
    this.secret_rules =
      data.type === PackageQuestionType.SECRET ? (data.secretRules ?? null) : null;
    this.type = data.type;
    this.isHidden = data.isHidden;
    this.text = data.text;
    this.text_order = data.textOrder ?? null;
    this.text_items = data.textItems ?? null;
    this.text_duration_ms = data.textDurationMs ?? null;
    this.text_wait_for_finish = data.textWaitForFinish ?? null;
    this.answer_duration_ms = data.answerDurationMs ?? null;
    this.answer_text_items = data.answerTextItems ?? null;
    this.showman_comments = data.showmanComments ?? null;
    this.answer_explanation = data.answerExplanation ?? null;
    this.play_media_simultaneously = data.playMediaSimultaneously ?? true;
    this.answer_hint = data.answerHint;
    this.answer_text = data.answerText;
    this.answer_type =
      data.answerType && data.answerType !== AnswerType.TEXT ? data.answerType : null;
    this.answer_number = data.answerNumber ?? null;
    this.answer_point = data.answerPoint ?? null;
    this.point_image_order = data.pointImageOrder ?? null;
    this.answer_deviation = data.answerDeviation ?? null;
    this.right_answers = nonEmpty(data.rightAnswers);
    this.wrong_answers = nonEmpty(data.wrongAnswers);
    this.authors = nonEmpty(data.authors);
    this.sources = nonEmpty(data.sources);
    this.answer_delay = data.answerDelay;
    this.question_comment = data.questionComment;
    this.sub_type = data.subType;
    this.max_price = data.maxPrice;
    this.allowed_prices = data.allowedPrices;
    this.transfer_type = data.transferType;
    this.price_multiplier = data.priceMultiplier;
    this.showDelay = data.showDelay;
    this.correctChoiceOrder = data.correctChoiceOrder ?? null;
    this.select_source_right_labels = data.selectSource?.rightLabels ?? null;
    this.show_answer_duration = data.showAnswerDuration;
  }

  public toDTO(fileUrlBuilder: IFileUrlBuilder, opts: PackageDTOOptions): PackageQuestionDTO {
    const questionFilesDTO =
      this.questionFiles && this.questionFiles.length > 0
        ? this.questionFiles.map((file) => file.toDTO(fileUrlBuilder, opts))
        : null;

    const answerFilesDTO =
      this.answerFiles && this.answerFiles.length > 0
        ? this.answerFiles.map((file) => file.toDTO(fileUrlBuilder, opts))
        : null;

    const answersDTO =
      this.answers && this.answers.length > 0
        ? this.answers.map((answer) => answer.toDTO(fileUrlBuilder, opts))
        : null;

    let dto: PackageQuestionDTO = {
      script: this.script ?? null,
      type: this.type,
      order: this.order,
      price: this.price,
      realPrice: this.realPrice ?? null,
      ...(this.secret_rules ? { secretRules: this.secret_rules } : {}),
      isHidden: this.isHidden,
      text: this.text,
      textOrder: this.text_order ?? null,
      textItems: this.text_items ?? null,
      textDurationMs: this.text_duration_ms ?? null,
      textWaitForFinish: this.text_wait_for_finish ?? null,
      answerDurationMs: this.answer_duration_ms ?? null,
      answerTextItems: this.answer_text_items ?? this.script?.answerTextItems ?? null,
      showmanComments: this.showman_comments ?? null,
      answerExplanation: this.answer_explanation ?? null,
      playMediaSimultaneously: this.play_media_simultaneously ?? true,
      answerHint: this.answer_hint,
      answerText: this.answer_text,
      ...(answerFormat({ type: this.type, answerType: this.answer_type }) === AnswerType.SELECT &&
      this.correctChoiceOrder != null
        ? { correctChoiceOrder: this.correctChoiceOrder }
        : {}),
      ...(opts.includeAuthoringMetadata && this.select_source_right_labels?.length
        ? { selectSource: { rightLabels: this.select_source_right_labels } }
        : {}),
      answerType: this.answer_type ?? AnswerType.TEXT,
      answerNumber: this.answer_number ?? null,
      answerPoint: this.answer_point ?? null,
      pointImageOrder: this.point_image_order ?? null,
      answerDeviation: this.answer_deviation ?? null,
      rightAnswers: this.right_answers ?? null,
      wrongAnswers: this.wrong_answers ?? null,
      authors: this.authors ?? null,
      sources: this.sources ?? null,
      answerDelay: this.answer_delay ?? 5000,
      questionComment: this.question_comment,
      questionFiles: questionFilesDTO,
      answerFiles: answerFilesDTO,
      subType: this.sub_type ?? PackageQuestionSubType.SIMPLE,
      showAnswerDuration: this.show_answer_duration,
      maxPrice: this.max_price,
      allowedPrices: this.allowed_prices,
      transferType: this.transfer_type,
      priceMultiplier: this.price_multiplier,
      showDelay: this.showDelay,
      answers: answersDTO
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

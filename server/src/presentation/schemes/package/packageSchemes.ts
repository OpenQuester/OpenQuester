import Joi from "joi";

import { CONTENT_ITEM_MAX_TIME, MAX_QUESTION_PRICE_UPLOAD } from "domain/constants/game";
import { LIMIT_MAX, LIMIT_MIN, OFFSET_MIN } from "domain/constants/pagination";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { AnswerType } from "domain/enums/package/AnswerType";
import { ContentPlacement } from "domain/enums/package/ContentPlacement";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { PackageUploadStatus } from "domain/enums/package/PackageUploadStatus";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { pointImage } from "domain/logic/question/PointImageLogic";
import { type PackageUploadBody } from "domain/types/dto/package/PackageUploadBody";
import {
  type PackageQuestionDTO,
  PackageQuestionSubType
} from "domain/types/dto/package/PackageQuestionDTO";
import { type PackageRoundDTO } from "domain/types/dto/package/PackageRoundDTO";
import { type PackageThemeDTO } from "domain/types/dto/package/PackageThemeDTO";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { type PackageSearchOpts } from "domain/types/pagination/package/PackageSearchOpts";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";

/** Up to 20 short texts (answers, authors, sources) */
const textList = () => Joi.array().items(Joi.string().max(500).allow("")).max(20).allow(null);

// File schema for basic file properties
const fileSchema = Joi.object({
  md5: Joi.string().required(),
  type: Joi.string()
    .valid(...Object.values(PackageFileType))
    .required()
});

// Schema for package files (questionFiles, answerFiles)
const packageFileSchema = Joi.object({
  file: fileSchema.required(),
  displayTime: Joi.number().allow(null).required(),
  order: Joi.number().min(0).required(),
  placement: Joi.string()
    .valid(...Object.values(ContentPlacement))
    .default(ContentPlacement.SCREEN),
  waitForFinish: Joi.boolean().default(true)
});

// Base question schema with common fields
type PackageQuestionInput = PackageQuestionDTO & { correctChoiceNeedsRepair?: unknown };

const baseQuestionSchema = Joi.object<PackageQuestionInput>({
  price: Joi.number().allow(null).max(MAX_QUESTION_PRICE_UPLOAD).required(), // Final round questions have null price - players bid after theme selection
  order: Joi.number().min(0).required(),
  type: Joi.string()
    .valid(...Object.values(PackageQuestionType))
    .required(),
  isHidden: Joi.when("type", {
    is: "hidden",
    then: Joi.boolean().valid(true).required(), // Must be true
    otherwise: Joi.boolean().allow(null).default(false) // Default false for others
  }),
  text: Joi.string().allow(null, ""),
  textOrder: Joi.number().integer().min(0).allow(null),
  textItems: Joi.array()
    .items(
      Joi.object({
        order: Joi.number().integer().min(0).max(2147483647).required(),
        text: Joi.string().pattern(/\S/).required()
      })
    )
    .allow(null),
  answerHint: Joi.string().allow(null, ""),
  answerText: Joi.string().allow(null, ""),
  answerType: Joi.string()
    .valid(...Object.values(AnswerType))
    .allow(null),
  answerNumber: Joi.when("answerType", {
    is: AnswerType.NUMBER,
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null)
  }),
  answerPoint: Joi.when("answerType", {
    is: AnswerType.POINT,
    then: Joi.object({
      x: Joi.number().min(0).max(1).required(),
      y: Joi.number().min(0).max(1).required(),
      imageAspectRatio: Joi.number().positive()
    }).required(),
    otherwise: Joi.object({
      x: Joi.number().min(0).max(1),
      y: Joi.number().min(0).max(1),
      imageAspectRatio: Joi.number().positive()
    }).allow(null)
  }),
  pointImageOrder: Joi.number().integer().min(0).max(2147483647).allow(null),
  answerDeviation: Joi.number().min(0).allow(null),
  rightAnswers: textList(),
  wrongAnswers: textList(),
  authors: textList(),
  sources: textList(),
  answerDelay: Joi.number().allow(null).default(5000),
  showAnswerDuration: Joi.number().required(),
  questionComment: Joi.string().allow(null, ""),
  questionFiles: Joi.array().items(packageFileSchema).allow(null),
  answerFiles: Joi.array().items(packageFileSchema).allow(null)
});

// Full question schema with type-specific fields
const questionSchema = baseQuestionSchema.keys({
  subType: Joi.when("type", {
    is: "stake",
    then: Joi.string()
      .valid(PackageQuestionSubType.SIMPLE, PackageQuestionSubType.FOR_EVERYONE)
      .required(),
    otherwise: Joi.when("type", {
      is: "secret",
      then: Joi.string()
        .valid(PackageQuestionSubType.SIMPLE, PackageQuestionSubType.CUSTOM_PRICE)
        .required(),
      otherwise: Joi.when("type", {
        is: "noRisk",
        then: Joi.string()
          .valid(PackageQuestionSubType.SIMPLE, PackageQuestionSubType.FOR_EVERYONE)
          .required(),
        otherwise: Joi.when("type", {
          is: "choice",
          then: Joi.string().valid(PackageQuestionSubType.SIMPLE).required(),
          otherwise: Joi.string() // For hidden and simple types it's optional
            .valid(PackageQuestionSubType.SIMPLE)
            .optional()
        })
      })
    })
  }),
  maxPrice: Joi.when("type", {
    is: "stake",
    then: Joi.number().allow(null).max(MAX_QUESTION_PRICE_UPLOAD).required(),
    otherwise: Joi.forbidden()
  }),
  allowedPrices: Joi.when("type", {
    is: "secret",
    then: Joi.when("subType", {
      is: PackageQuestionSubType.CUSTOM_PRICE,
      then: Joi.array().items(Joi.number().max(MAX_QUESTION_PRICE_UPLOAD)).min(2).max(5).required(),
      otherwise: Joi.optional().valid(null)
    }),
    otherwise: Joi.optional().valid(null)
  }),
  transferType: Joi.when("type", {
    is: "secret",
    then: Joi.string()
      .valid(...Object.values(PackageQuestionTransferType))
      .required(),
    otherwise: Joi.forbidden()
  }),
  priceMultiplier: Joi.when("type", {
    is: "noRisk",
    then: Joi.number().required(),
    otherwise: Joi.forbidden()
  }),
  showDelay: Joi.when("type", {
    is: "choice",
    then: Joi.number().required(),
    otherwise: Joi.forbidden()
  }),
  correctChoiceOrder: Joi.when("type", {
    is: "choice",
    then: Joi.number().integer().min(0).allow(null),
    otherwise: Joi.forbidden()
  }),
  // Archive-only marker: an unresolved draft cannot be published as legacy.
  correctChoiceNeedsRepair: Joi.forbidden(),
  answers: Joi.when("type", {
    is: "choice",
    then: Joi.array()
      .items(
        Joi.object({
          text: Joi.string().allow(null),
          file: fileSchema.allow(null),
          order: Joi.number().min(0).required()
        })
      )
      .min(2)
      .max(8)
      .required(),
    otherwise: Joi.forbidden()
  })
});

const validateChoiceKey = (question: PackageQuestionDTO, helpers: Joi.CustomHelpers) => {
  if (
    question.correctChoiceOrder != null &&
    (question.answers ?? []).filter((answer) => answer.order === question.correctChoiceOrder)
      .length !== 1
  ) {
    return helpers.error("any.invalid");
  }
  return question;
};

const validateQuestionContent = (question: PackageQuestionDTO, helpers: Joi.CustomHelpers) => {
  if (
    question.pointImageOrder != null &&
    !pointImage(question.questionFiles, question.pointImageOrder)
  ) {
    return helpers.error("any.invalid");
  }
  const orders = new Set<number>();
  for (const file of question.questionFiles ?? []) {
    if (question.textItems != null && orders.has(file.order)) return helpers.error("any.invalid");
    orders.add(file.order);
  }
  if (question.textOrder != null) {
    if (question.textItems != null && orders.has(question.textOrder)) return helpers.error("any.invalid");
    orders.add(question.textOrder);
  }
  for (const item of question.textItems ?? []) {
    if (orders.has(item.order)) return helpers.error("any.invalid");
    orders.add(item.order);
  }
  return question;
};

const validateFinalMediaDuration = (question: PackageQuestionDTO, helpers: Joi.CustomHelpers) => {
  if (
    question.textItems != null &&
    (question.questionFiles ?? []).some(
      ({ file, displayTime }) =>
        (file.type === PackageFileType.AUDIO || file.type === PackageFileType.VIDEO) &&
        (!Number.isInteger(displayTime) ||
          displayTime! <= 0 ||
          displayTime! > CONTENT_ITEM_MAX_TIME)
    )
  )
    return helpers.error("any.invalid");
  return question;
};

const questions = Joi.array()
  .items(questionSchema.custom(validateChoiceKey).custom(validateQuestionContent))
  .required();

// Themes schema with conditional validation for final rounds
const themes = Joi.array()
  .items(
    Joi.object<PackageThemeDTO>({
      name: Joi.string().required(),
      order: Joi.number().min(0).required(),
      description: Joi.string().allow(null, ""),
      questions
    }).required()
  )
  .required();

// Final round themes schema - each theme must have exactly one simple question
const finalRoundThemes = Joi.array()
  .items(
    Joi.object<PackageThemeDTO>({
      name: Joi.string().required(),
      order: Joi.number().min(0).required(),
      description: Joi.string().allow(null, ""),
      questions: Joi.array()
        .items(
          questionSchema
            .keys({
              type: Joi.string().valid("simple").required(),
              price: Joi.allow(null).required(), // Final round questions must have null price
              isHidden: Joi.boolean().valid(false).optional()
            })
            .custom(validateChoiceKey)
            .custom(validateQuestionContent)
            .custom(validateFinalMediaDuration)
        )
        .length(1) // Exactly one question per theme in final round
        .required()
    }).required()
  )
  .required();

// Rounds schema
const rounds = Joi.array()
  .items(
    Joi.object<PackageRoundDTO>({
      name: Joi.string().required(),
      order: Joi.number().min(0).required(),
      description: Joi.string().allow(null),
      type: Joi.string()
        .valid(...Object.values(PackageRoundType))
        .required(),
      themes: Joi.when("type", {
        is: PackageRoundType.FINAL,
        then: finalRoundThemes,
        otherwise: themes
      })
    }).required()
  )
  .required()
  .custom((value, helpers) => {
    // Validate that there's at only final round per package
    const finalRounds = value.filter(
      (round: PackageRoundDTO) => round.type === PackageRoundType.FINAL
    );
    if (finalRounds.length > 1) {
      return helpers.error("custom.multipleFinalRounds");
    }

    // If there's a final round, it should be the last round
    if (finalRounds.length === 1) {
      const finalRoundIndex = value.findIndex(
        (round: PackageRoundDTO) => round.type === PackageRoundType.FINAL
      );
      if (finalRoundIndex !== value.length - 1) {
        return helpers.error("custom.finalRoundNotLast");
      }
    }

    return value;
  }, "Final round validation")
  .messages({
    "custom.multipleFinalRounds": "Package can have only one final round",
    "custom.finalRoundNotLast": "Final round must be the last round in the package"
  });

// Top-level upload package schema
export const uploadPackageScheme = () =>
  Joi.object<PackageUploadBody>({
    // Fingerprint of the imported file, so a second upload of it can be spotted.
    sourceHash: Joi.string().hex().max(64).allow(null).optional(),
    // Bytes per media file (MD5 → size), checked against the storage limits.
    fileSizes: Joi.object()
      .pattern(/^[a-fA-F0-9]{32}(\.[A-Za-z0-9]+)?$/, Joi.number().integer().min(0).required())
      .optional(),
    content: Joi.object({
      title: Joi.string().required(),
      description: Joi.string().allow(null),
      createdAt: Joi.date().default(new Date()).allow(null),
      language: Joi.string().allow(null),
      authors: textList(),
      sources: textList(),
      ageRestriction: Joi.string()
        .valid(...Object.values(AgeRestriction))
        .required(),
      logo: Joi.object({
        file: fileSchema.required()
      }).allow(null),
      tags: Joi.array()
        .items(
          Joi.object({
            tag: Joi.string()
          })
        )
        .allow(null),
      rounds
    }).required()
  });

export const packIdScheme = () =>
  Joi.object({
    packageId: Joi.number().required()
  });

export const packageSearchScheme = () =>
  Joi.object<PackageSearchOpts>({
    title: Joi.string().optional(),
    description: Joi.string().optional(),
    language: Joi.string().optional(),
    authorId: Joi.number().optional(),
    tags: Joi.alternatives()
      .try(
        Joi.array().items(Joi.string()),
        Joi.string().custom((value) => {
          // Handle comma-separated string as array
          return value.split(",").map((tag: string) => tag.trim());
        })
      )
      .optional(),
    ageRestriction: Joi.string()
      .valid(...Object.values(AgeRestriction))
      .optional(),
    sourceHash: Joi.string().hex().max(64).optional(),
    uploadStatus: Joi.string()
      .valid(...Object.values(PackageUploadStatus))
      .optional(),
    minRounds: Joi.number().min(0).optional(),
    maxRounds: Joi.number().min(0).optional(),
    minQuestions: Joi.number().min(0).optional(),
    maxQuestions: Joi.number().min(0).optional(),
    sortBy: Joi.string().valid("id", "title", "created_at", "author").default("created_at"),
    order: Joi.string()
      .valid(PaginationOrder.ASC, PaginationOrder.DESC)
      .default(PaginationOrder.ASC),
    limit: Joi.number().min(LIMIT_MIN).max(LIMIT_MAX).required(),
    offset: Joi.number().min(OFFSET_MIN).required()
  });

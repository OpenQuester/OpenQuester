import Joi from "joi";

import { LIMIT_MAX, LIMIT_MIN, OFFSET_MIN } from "domain/constants/pagination";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import {
  PackageQuestionDTO,
  PackageQuestionSubType,
} from "domain/types/dto/package/PackageQuestionDTO";
import { PackageRoundDTO } from "domain/types/dto/package/PackageRoundDTO";
import { PackageThemeDTO } from "domain/types/dto/package/PackageThemeDTO";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { PackagePaginationOpts } from "domain/types/pagination/package/PackagePaginationOpts";
import { PaginationOrder } from "domain/types/pagination/PaginationOpts";

// File schema for basic file properties
const fileSchema = Joi.object({
  md5: Joi.string().required(),
  type: Joi.string()
    .valid(...Object.values(PackageFileType))
    .required(),
});

// Schema for package files (questionFiles, answerFiles)
const packageFileSchema = Joi.object({
  file: fileSchema.required(),
  displayTime: Joi.number().valid(null).required(),
  order: Joi.number().min(0).required(),
});

// Base question schema with common fields
const baseQuestionSchema = Joi.object<PackageQuestionDTO>({
  price: Joi.number().allow(null).required(), // Final round questions have null price - players bid after theme selection
  order: Joi.number().min(0).required(),
  type: Joi.string()
    .valid(...Object.values(PackageQuestionType))
    .required(),
  isHidden: Joi.when("type", {
    is: "hidden",
    then: Joi.boolean().valid(true).required(), // Must be true
    otherwise: Joi.boolean().allow(null).default(false), // Default false for others
  }),
  text: Joi.string().allow(null),
  answerHint: Joi.string().allow(null),
  answerText: Joi.string().allow(null),
  answerDelay: Joi.number().allow(null).default(5000),
  questionComment: Joi.string().allow(null),
  questionFiles: Joi.array().items(packageFileSchema).allow(null),
  answerFiles: Joi.array().items(packageFileSchema).allow(null),
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
        .valid(
          PackageQuestionSubType.SIMPLE,
          PackageQuestionSubType.CUSTOM_PRICE
        )
        .required(),
      otherwise: Joi.when("type", {
        is: "noRisk",
        then: Joi.string()
          .valid(
            PackageQuestionSubType.SIMPLE,
            PackageQuestionSubType.FOR_EVERYONE
          )
          .required(),
        otherwise: Joi.when("type", {
          is: "choice",
          then: Joi.string().valid(PackageQuestionSubType.SIMPLE).required(),
          otherwise: Joi.string() // For hidden and simple types it's optional
            .valid(PackageQuestionSubType.SIMPLE)
            .optional(),
        }),
      }),
    }),
  }),
  maxPrice: Joi.when("type", {
    is: "stake",
    then: Joi.number().allow(null).required(),
    otherwise: Joi.forbidden(),
  }),
  allowedPrices: Joi.when("type", {
    is: "secret",
    then: Joi.when("subType", {
      is: PackageQuestionSubType.CUSTOM_PRICE,
      then: Joi.array().items(Joi.number()).min(2).max(5).required(),
      otherwise: Joi.optional().valid(null),
    }),
    otherwise: Joi.optional().valid(null),
  }),
  transferType: Joi.when("type", {
    is: "secret",
    then: Joi.string()
      .valid(...Object.values(PackageQuestionTransferType))
      .required(),
    otherwise: Joi.forbidden(),
  }),
  priceMultiplier: Joi.when("type", {
    is: "noRisk",
    then: Joi.number().required(),
    otherwise: Joi.forbidden(),
  }),
  showDelay: Joi.when("type", {
    is: "choice",
    then: Joi.number().required(),
    otherwise: Joi.forbidden(),
  }),
  answers: Joi.when("type", {
    is: "choice",
    then: Joi.array()
      .items(
        Joi.object({
          text: Joi.string().allow(null),
          file: fileSchema.allow(null),
          order: Joi.number().min(0).required(),
        })
      )
      .min(2)
      .max(8)
      .required(),
    otherwise: Joi.forbidden(),
  }),
});

const questions = Joi.array().items(questionSchema).required();

// Themes schema with conditional validation for final rounds
const themes = Joi.array()
  .items(
    Joi.object<PackageThemeDTO>({
      name: Joi.string().required(),
      order: Joi.number().min(0).required(),
      description: Joi.string().allow(null),
      questions,
    }).required()
  )
  .required();

// Final round themes schema - each theme must have exactly one simple question
const finalRoundThemes = Joi.array()
  .items(
    Joi.object<PackageThemeDTO>({
      name: Joi.string().required(),
      order: Joi.number().min(0).required(),
      description: Joi.string().allow(null),
      questions: Joi.array()
        .items(
          questionSchema.keys({
            type: Joi.string().valid("simple").required(),
            price: Joi.valid(null).required(), // Final round questions must have null price
            isHidden: Joi.boolean().valid(false).optional(),
          })
        )
        .length(1) // Exactly one question per theme in final round
        .required(),
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
        otherwise: themes,
      }),
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
    "custom.finalRoundNotLast":
      "Final round must be the last round in the package",
  });

// Top-level upload package schema
export const uploadPackageScheme = () =>
  Joi.object<Record<"content", PackageDTO>>({
    content: Joi.object({
      title: Joi.string().required(),
      description: Joi.string().allow(null),
      createdAt: Joi.date().default(new Date()).allow(null),
      language: Joi.string().allow(null),
      ageRestriction: Joi.string()
        .valid(...Object.values(AgeRestriction))
        .required(),
      logo: Joi.object({
        file: fileSchema.required(),
      }).allow(null),
      tags: Joi.array()
        .items(
          Joi.object({
            tag: Joi.string(),
          })
        )
        .allow(null),
      rounds,
    }).required(),
  });

export const packIdScheme = () =>
  Joi.object({
    packageId: Joi.number().required(),
  });

export const packagePaginationScheme = () =>
  Joi.object<PackagePaginationOpts>({
    title: Joi.string().optional(),
    sortBy: Joi.string()
      .valid("id", "title", "created_at", "author")
      .default("created_at"),
    order: Joi.string()
      .valid(PaginationOrder.ASC, PaginationOrder.DESC)
      .default(PaginationOrder.ASC),
    limit: Joi.number().min(LIMIT_MIN).max(LIMIT_MAX).required(),
    offset: Joi.number().min(OFFSET_MIN).required(),
  });

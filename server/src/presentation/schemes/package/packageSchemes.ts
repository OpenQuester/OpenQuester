import { questionScriptScheme } from "presentation/schemes/package/questionScriptScheme";
import { validateQuestionScript } from "domain/logic/question/validateQuestionScript";
import Joi from "joi";
import { answerFormat } from "domain/logic/question/answerFormat";

import { CONTENT_ITEM_MAX_TIME, MAX_QUESTION_PRICE_UPLOAD } from "domain/constants/game";
import { LIMIT_MAX, LIMIT_MIN, OFFSET_MIN } from "domain/constants/pagination";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { AnswerType } from "domain/enums/package/AnswerType";
import { ContentPlacement } from "domain/enums/package/ContentPlacement";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { PackageUploadStatus } from "domain/enums/package/PackageUploadStatus";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { findPointAnswerImage } from "domain/logic/question/PointImageLogic";
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
    .valid(ContentPlacement.SCREEN, ContentPlacement.BACKGROUND)
    .default(ContentPlacement.SCREEN),
  waitForFinish: Joi.boolean().default(true)
});

const pointTargetSchema = Joi.object({
  x: Joi.number().min(0).max(1).required(),
  y: Joi.number().min(0).max(1).required(),
  imageAspectRatio: Joi.number().positive(),
  sourceGeometry: Joi.object({
    kind: Joi.string().valid("sigame").required(),
    aspectRatio: Joi.number().positive().required()
  })
});

const textItemSchema = Joi.object({
  order: Joi.number().integer().min(0).max(2147483647).required(),
  text: Joi.string()
    .when("durationMs", {
      is: Joi.number().positive().required(),
      then: Joi.string().allow(""),
      otherwise: Joi.string().pattern(/\S/)
    })
    .required(),
  durationMs: Joi.number().integer().min(1).max(CONTENT_ITEM_MAX_TIME).allow(null),
  waitForFinish: Joi.boolean(),
  placement: Joi.string().valid("screen", "replic")
});

// Base question schema with common fields
type PackageQuestionInput = PackageQuestionDTO & {
  correctChoiceNeedsRepair?: unknown;
  compatibilityIssues?: unknown;
};

const baseQuestionSchema = Joi.object<PackageQuestionInput>({
  script: questionScriptScheme,
  price: Joi.number().allow(null).max(MAX_QUESTION_PRICE_UPLOAD).required(), // Final round questions have null price - players bid after theme selection
  realPrice: Joi.number().integer().min(0).max(MAX_QUESTION_PRICE_UPLOAD).allow(null),
  compatibilityIssues: Joi.forbidden(),
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
  textDurationMs: Joi.number().integer().min(1).max(CONTENT_ITEM_MAX_TIME).allow(null),
  textWaitForFinish: Joi.boolean().allow(null),
  textItems: Joi.array().items(textItemSchema).allow(null),
  answerTextItems: Joi.array().items(textItemSchema).allow(null),
  answerDurationMs: Joi.number().integer().min(0).max(2147483647).allow(null),
  showmanComments: Joi.string().allow(null, ""),
  answerExplanation: Joi.string().allow(null, ""),
  playMediaSimultaneously: Joi.boolean().allow(null).default(true),
  answerHint: Joi.string().allow(null, ""),
  answerText: Joi.string().allow(null, ""),
  answerType: Joi.string()
    .valid(...Object.values(AnswerType))
    .allow(null),
  answerNumber: Joi.when("answerType", {
    is: AnswerType.NUMBER,
    then: Joi.when("secretRules.outcome", {
      is: Joi.valid("award").required(),
      then: Joi.number().allow(null),
      otherwise: Joi.number().required()
    }),
    otherwise: Joi.number().allow(null)
  }),
  answerPoint: Joi.when("answerType", {
    is: AnswerType.POINT,
    then: Joi.when("secretRules.outcome", {
      is: Joi.valid("award").required(),
      then: pointTargetSchema.allow(null),
      otherwise: pointTargetSchema.required()
    }),
    otherwise: Joi.object({
      x: Joi.number().min(0).max(1),
      y: Joi.number().min(0).max(1),
      imageAspectRatio: Joi.number().positive(),
      sourceGeometry: Joi.object({
        kind: Joi.string().valid("sigame").required(),
        aspectRatio: Joi.number().positive().required()
      })
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

const secretPriceRuleSchema = Joi.alternatives()
  .try(
    Joi.object({ kind: Joi.string().valid("roundExtremes").required() }),
    Joi.object({
      kind: Joi.string().valid("range").required(),
      min: Joi.number().integer().min(0).max(MAX_QUESTION_PRICE_UPLOAD).required(),
      max: Joi.number().integer().greater(Joi.ref("min")).max(MAX_QUESTION_PRICE_UPLOAD).required(),
      step: Joi.number().integer().min(0).max(MAX_QUESTION_PRICE_UPLOAD).required()
    })
  )
  .allow(null)
  .required();

const secretRulesSchema = Joi.object({
  outcome: Joi.string().valid("question", "award").required(),
  priceAnnouncement: Joi.string().valid("beforeTransfer", "afterTransfer").required(),
  priceChooser: Joi.string().valid("opener", "receiver").required(),
  priceRule: secretPriceRuleSchema
}).allow(null);

// Full question schema with type-specific fields
const choiceOptions = Joi.array().items(
  Joi.object({
    text: Joi.string().allow(null, ""),
    file: fileSchema.allow(null),
    sourceLabel: Joi.string().max(500).allow(null, ""),
    order: Joi.number().integer().min(0).required()
  })
);

const questionSchema = baseQuestionSchema.keys({
  secretRules: Joi.when("type", {
    is: "secret",
    then: secretRulesSchema,
    otherwise: Joi.forbidden()
  }),
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
          then: Joi.string()
            .valid(PackageQuestionSubType.SIMPLE, PackageQuestionSubType.FOR_EVERYONE)
            .required(),
          otherwise: Joi.when("type", {
            is: "simple",
            then: Joi.string().valid(
              PackageQuestionSubType.SIMPLE,
              PackageQuestionSubType.FOR_EVERYONE
            ),
            otherwise: Joi.string().valid(PackageQuestionSubType.SIMPLE)
          })
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
      then: Joi.array()
        .items(Joi.number().integer().min(0).max(MAX_QUESTION_PRICE_UPLOAD))
        .min(2)
        .max(5)
        .required(),
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
  showDelay: Joi.number().min(0),
  correctChoiceOrder: Joi.number().integer().min(0).allow(null),
  selectSource: Joi.object({
    rightLabels: Joi.array().items(Joi.string().max(500)).min(1).max(1000).unique().required()
  }).unknown(false),
  // Archive-only marker: an unresolved draft cannot be published as legacy.
  correctChoiceNeedsRepair: Joi.forbidden(),
  answers: Joi.when("script", {
    is: Joi.object().required(),
    then: choiceOptions.max(1000),
    otherwise: choiceOptions.min(2)
  })
});

const validateQuestionPrices = (question: PackageQuestionDTO, helpers: Joi.CustomHelpers) => {
  if (
    question.type === PackageQuestionType.SECRET &&
    question.subType === PackageQuestionSubType.CUSTOM_PRICE &&
    question.realPrice != null
  ) {
    return helpers.error("any.invalid");
  }
  return question;
};

const validateChoiceKey = (question: PackageQuestionDTO, helpers: Joi.CustomHelpers) => {
  if (question.script) {
    return question.selectSource == null ? question : helpers.error("any.invalid");
  }
  if (answerFormat(question) !== AnswerType.SELECT) {
    return question.answers !== undefined ||
      question.correctChoiceOrder !== undefined ||
      question.selectSource !== undefined ||
      question.showDelay !== undefined
      ? helpers.error("any.invalid")
      : question;
  }
  const options = question.answers ?? [];
  const explicitSelect = question.answerType === AnswerType.SELECT;
  if (
    options.length < 2 ||
    new Set(options.map((option) => option.order)).size !== options.length ||
    (explicitSelect &&
      (question.correctChoiceOrder == null ||
        options.some((option) => !option.text?.trim() && !option.file)))
  ) {
    return helpers.error("any.invalid");
  }
  if (
    question.correctChoiceOrder != null &&
    (question.answers ?? []).filter((answer) => answer.order === question.correctChoiceOrder)
      .length !== 1
  ) {
    return helpers.error("any.invalid");
  }
  if (question.selectSource) {
    const counts = new Map<string, number>();
    for (const { sourceLabel } of options) {
      if (sourceLabel) {
        counts.set(sourceLabel, (counts.get(sourceLabel) ?? 0) + 1);
      }
    }
    if (question.selectSource.rightLabels.some((label) => counts.get(label) !== 1)) {
      return helpers.error("any.invalid");
    }
  }
  return question;
};

const validateQuestionContent = (question: PackageQuestionDTO, helpers: Joi.CustomHelpers) => {
  if (!validateQuestionScript(question)) {
    return helpers.error("any.invalid");
  }
  if (
    question.secretRules?.outcome !== "award" &&
    question.pointImageOrder != null &&
    !findPointAnswerImage(question.questionFiles, question.pointImageOrder)
  ) {
    return helpers.error("any.invalid");
  }
  const rules = question.script ? null : question.secretRules;
  if (
    (rules && question.allowedPrices?.length) ||
    (!question.script &&
      question.realPrice != null &&
      (rules?.priceRule || question.allowedPrices?.length)) ||
    (rules?.priceChooser === "opener" && rules.priceAnnouncement !== "beforeTransfer") ||
    (rules?.outcome === "award" &&
      (rules.priceChooser !== "receiver" || rules.priceAnnouncement !== "afterTransfer"))
  ) {
    return helpers.error("any.invalid");
  }
  if (
    rules?.outcome === "question" &&
    !question.text?.trim() &&
    !question.textItems?.some((item) => item.text.trim()) &&
    !question.questionFiles?.length
  ) {
    return helpers.error("any.invalid");
  }
  if (
    rules?.outcome === "question" &&
    !question.answerText?.trim() &&
    !question.answerFiles?.length &&
    question.answerType !== AnswerType.NUMBER &&
    question.answerType !== AnswerType.POINT &&
    !(question.answers?.length && question.correctChoiceOrder != null)
  ) {
    return helpers.error("any.invalid");
  }
  const orders = new Set<number>();
  for (const file of question.questionFiles ?? []) {
    if (question.textItems != null && orders.has(file.order)) return helpers.error("any.invalid");
    orders.add(file.order);
  }
  if (question.textOrder != null) {
    if (question.textItems != null && orders.has(question.textOrder))
      return helpers.error("any.invalid");
    orders.add(question.textOrder);
  }
  for (const item of question.textItems ?? []) {
    if (orders.has(item.order)) return helpers.error("any.invalid");
    orders.add(item.order);
  }
  const answerOrders = new Set<number>();
  for (const item of [...(question.answerFiles ?? []), ...(question.answerTextItems ?? [])]) {
    if (answerOrders.has(item.order)) {
      return helpers.error("any.invalid");
    }
    answerOrders.add(item.order);
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
  .items(
    questionSchema
      .custom(validateQuestionPrices)
      .custom(validateChoiceKey)
      .custom(validateQuestionContent)
  )
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
              type: Joi.when("script", {
                is: Joi.object().required(),
                then: Joi.string()
                  .valid(...Object.values(PackageQuestionType))
                  .required(),
                otherwise: Joi.string().valid("simple").required()
              }),
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

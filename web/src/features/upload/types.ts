/**
 * What POST /v1/packages accepts (server/src/presentation/schemes/package/packageSchemes.ts).
 * Kept loose on purpose: the generated union types are stricter than the
 * server's Joi scheme, and the readers below only ever build valid shapes.
 */
export type MediaType = "image" | "audio" | "video";

export interface FileRef {
  md5: string;
  type: MediaType;
}

export interface QuestionFile {
  file: FileRef;
  order: number;
  displayTime: number | null;
  /** Defaults to screen; background is audio under the stage. */
  placement?: "screen" | "background";
  /** False shows the next item together with this one. Defaults to true. */
  waitForFinish?: boolean;
}

export interface UploadQuestion {
  type: "simple" | "stake" | "secret" | "noRisk" | "hidden" | "choice";
  subType?: string;
  order: number;
  price: number | null;
  text?: string | null;
  /** Position of the text among the question files; null keeps it as a caption. */
  textOrder?: number | null;
  questionComment?: string | null;
  answerText?: string | null;
  answerHint?: string | null;
  answerDelay?: number | null;
  showAnswerDuration: number;
  isHidden?: boolean;
  questionFiles?: QuestionFile[] | null;
  answerFiles?: QuestionFile[] | null;
  maxPrice?: number | null;
  transferType?: "any" | "exceptCurrent";
  allowedPrices?: number[] | null;
  priceMultiplier?: number;
  showDelay?: number;
  answers?: { order: number; text: string | null; file: FileRef | null }[];
}

export interface UploadTheme {
  name: string;
  order: number;
  description?: string | null;
  questions: UploadQuestion[];
}

export interface UploadRound {
  name: string;
  order: number;
  description?: string | null;
  type: "simple" | "final";
  themes: UploadTheme[];
}

export interface UploadContent {
  title: string;
  description?: string | null;
  language?: string | null;
  ageRestriction: "NONE" | "A12" | "A16" | "A18";
  logo?: { file: FileRef } | null;
  tags: { tag: string }[];
  rounds: UploadRound[];
}

export interface MediaFile {
  md5: string;
  type: MediaType;
  /** Name inside the archive, used for the upload content type. */
  name: string;
  bytes: Uint8Array;
  /**
   * Set for a file already in storage (opened from a published package): it
   * may have no bytes, is shown from this address and is never uploaded again.
   */
  url?: string;
}

/** Something the reader fixed or skipped, shown before upload so nothing is a surprise. */
export interface ImportWarning {
  code:
    | "missingFile"
    | "externalMedia"
    | "emptyQuestion"
    | "noAnswer"
    | "choiceAsSimple"
    | "unknownType"
    | "hashMismatch";
  /** Round › theme › price, or empty for package-level warnings. */
  where: string;
  detail?: string;
}

export interface ParsedPackage {
  format: "siq" | "oq";
  content: UploadContent;
  /** Media keyed by MD5, the name the server gives each upload link. */
  files: Map<string, MediaFile>;
  warnings: ImportWarning[];
}

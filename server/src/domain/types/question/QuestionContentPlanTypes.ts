import type { PackageQuestionFileDTO } from "domain/types/dto/package/PackageQuestionFileDTO";
import type { QuestionTextItemDTO } from "domain/types/dto/package/PackageQuestionDTO";

/** Fallback lengths when neither displayTime nor a reported length exists. */
export interface ContentDefaults {
  imageMs: number;
  audioMs: number;
  videoMs: number;
}

export interface QuestionContentSource {
  text?: string | null;
  /** Null/undefined keeps the text visible as a caption. */
  textOrder?: number | null;
  textItems?: QuestionTextItemDTO[] | null;
  playMediaSimultaneously?: boolean | null;
  files?: PackageQuestionFileDTO[] | null;
}

/** Real media lengths reported by clients, keyed by file md5. */
export type MediaDurations = Record<string, number>;

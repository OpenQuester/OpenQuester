import { ContentPlacement } from "domain/enums/package/ContentPlacement";

export enum QuestionContentItemKind {
  TEXT = "text",
  FILE = "file",
}

export interface QuestionContentPlanItemDTO {
  kind: QuestionContentItemKind;
  /** File order for FILE items; the question's textOrder for TEXT items */
  order: number;
  placement: ContentPlacement;
  /** How long this item plays; a background sound can outlive its step */
  durationMs: number;
}

export interface QuestionContentStepDTO {
  /** Offset from the start of the content timeline */
  startMs: number;
  durationMs: number;
  items: QuestionContentPlanItemDTO[];
}

/**
 * Server-timed sequence of question (or answer) content.
 *
 * Steps play one after another. The timeline runs on the phase timer
 * (SHOWING for questions, SHOWING_ANSWER for answers): the position is the
 * timer's elapsed time, so pauses, answers and reconnects keep every client
 * on the same step. A step without screen items keeps the previous screen.
 */
export interface QuestionContentPlanDTO {
  steps: QuestionContentStepDTO[];
  totalMs: number;
}

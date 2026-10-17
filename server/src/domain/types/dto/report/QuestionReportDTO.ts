export enum QuestionReportReason {
  WRONG_ANSWER = "wrong_answer",
  BROKEN_MEDIA = "broken_media",
  OFFENSIVE = "offensive",
  OTHER = "other"
}

export interface QuestionReportInputDTO {
  questionId: number;
  reason: QuestionReportReason;
  comment?: string | null;
}

export interface QuestionReportDTO {
  id: number;
  packageId: number;
  questionId: number;
  /** The question's text when the report was made, so it reads even after edits */
  questionText: string | null;
  reason: QuestionReportReason;
  comment: string | null;
  resolved: boolean;
  reporter: { id: number; username: string } | null;
  gameId: string | null;
  createdAt: Date;
}

/** A package's reports as its author sees them. */
export interface QuestionReportListDTO {
  data: QuestionReportDTO[];
  /** How many reports are not resolved yet. */
  open: number;
}

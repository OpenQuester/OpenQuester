import { type PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { AnswerReviewData } from "domain/types/socket/finalround/FinalRoundResults";
import { QuestionAnswerData } from "domain/types/socket/finalround/QuestionAnswerData";
import { FinalRoundQuestionData } from "domain/types/finalround/FinalRoundInterfaces";

export type FinalAnsweringToReviewingMutationData = {
  allReviews: AnswerReviewData[];
};

export type FinalReviewingToGameFinishMutationData = {
  isGameFinished: boolean;
  questionAnswerData: QuestionAnswerData | null;
};

export type FinalBiddingToAnsweringMutationData = {
  questionData: FinalRoundQuestionData;
  /** Full question (with answer) for the showman's role-filtered copy */
  fullQuestion: PackageQuestionDTO | null;
};

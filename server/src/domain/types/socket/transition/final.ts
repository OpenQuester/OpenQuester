import { AnswerReviewData } from "../finalround/FinalRoundResults";
import { QuestionAnswerData } from "../finalround/QuestionAnswerData";
import { FinalRoundQuestionData } from "../../finalround/FinalRoundInterfaces";

export type FinalAnsweringToReviewingMutationData = {
  allReviews: AnswerReviewData[];
};

export type FinalReviewingToGameFinishMutationData = {
  isGameFinished: boolean;
  questionAnswerData: QuestionAnswerData | null;
};

export type FinalBiddingToAnsweringMutationData = {
  questionData: FinalRoundQuestionData;
};

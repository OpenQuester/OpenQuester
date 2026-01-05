import { TransitionContext } from "domain/state-machine/types";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";

export type QuestionPickPayload = {
  questionId: number;
};

export type ChoosingToMediaDownloadingCtx =
  TransitionContext<QuestionPickPayload>;

export interface ChoosingToMediaDownloadingMutationData {
  question: SimplePackageQuestionDTO;
}

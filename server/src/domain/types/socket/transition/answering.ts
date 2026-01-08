import { TransitionContext } from "domain/state-machine/types";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";

export type AnsweringToShowingCtx =
  TransitionContext<AnswerResultTransitionPayload>;

export type AnsweringToShowingAnswerCtx =
  TransitionContext<AnswerResultTransitionPayload>;

export type AnswerResultTransitionPayload = {
  answerType: AnswerResultType;
  scoreResult: number;
};

export interface AnsweringToShowingAnswerMutationData {
  playerAnswerResult: GameStateAnsweredPlayerData;
  question: PackageQuestionDTO | null;
  isCorrect: boolean;
}

export interface AnsweringToShowingMutationData {
  answeringPlayer: number | null;
  playerAnswerResult: GameStateAnsweredPlayerData;
}

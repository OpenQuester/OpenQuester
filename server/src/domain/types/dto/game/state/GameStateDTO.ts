import { GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";

export interface GameStateAnsweredPlayerData {
  player: number;
  /** Result can be -n, +n or 0 */
  result: number;
  score: number;
  answerType: AnswerResultType;
}

export interface GameStateDTO {
  questionState: QuestionState | null;
  isPaused: boolean;
  currentRound: GameStateRoundDTO | null;
  currentQuestion: SimplePackageQuestionDTO | null; // Only if chosen
  answeringPlayer: number | null; // Only if answering
  answeredPlayers: GameStateAnsweredPlayerData[] | null;
  /** This is used as readiness at game start and as readiness for another events */
  readyPlayers: number[] | null;
  timer: GameStateTimerDTO | null;
}

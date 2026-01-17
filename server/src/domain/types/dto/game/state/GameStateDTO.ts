import { GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { FinalRoundGameData } from "domain/types/finalround/FinalRoundInterfaces";
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
  /** Final round specific data */
  finalRoundData?: FinalRoundGameData | null;
  /** Which player can pick a question or eliminate theme in final */
  currentTurnPlayerId?: number | null;
  /** Players who have skipped the current question */
  skippedPlayers: number[] | null;
  /** Secret question specific data - only set when a secret question is picked */
  secretQuestionData?: SecretQuestionGameData | null;
  /** Stake question specific data - only set when a stake question is picked and bidding ended */
  stakeQuestionData?: StakeQuestionGameData | null;
  /** Game password - only visible to players who have joined the game */
  password?: string | null;
  /**
   * Players who were in-game when the current question started.
   *
   * This prevents players who join mid-question from answering.
   *
   * Set when question is picked, cleared when returning to CHOOSING state.
   */
  questionEligiblePlayers?: number[] | null;
}

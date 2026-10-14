import { AllPlayDataDTO } from "domain/types/dto/game/state/AllPlayDataDTO";
import { GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionContentPlanDTO } from "domain/types/dto/game/state/QuestionContentPlanDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { SimplePackageQuestionDTO } from "domain/types/dto/package/SimplePackageQuestionDTO";
import { FinalRoundGameData } from "domain/types/finalround/FinalRoundInterfaces";
import {
  type QuestionFinishEventPayload,
  type QuestionFinishWithAnswerEventPayload
} from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";

export interface GameStateAnsweredPlayerData {
  player: number;
  /** Result can be -n, +n or 0 */
  result: number;
  score: number;
  answerType: AnswerResultType;
}

export interface BuzzerWindowDTO {
  /** When the first press arrived (epoch ms) */
  openedAt: number;
  /** Players who pressed inside the window, in arrival order */
  presses: number[];
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
  /**
   * Timeline of the current question's content, run on the SHOWING timer.
   * Null when the question has nothing to sequence (text only, single caption).
   */
  questionContentPlan?: QuestionContentPlanDTO | null;
  /** Real audio/video lengths reported by players while preloading, by md5 */
  mediaDurations?: Record<string, number> | null;
  /**
   * Position on the SHOWING timer (ms) when the buzzer opens: after the
   * content timeline, the reading time of a caption text and the question's
   * answer delay. A press before that is a false start. 0 or null: open now.
   */
  buzzerOpensAtMs?: number | null;
  /** Presses collected in the accept window after the first press */
  buzzerWindow?: BuzzerWindowDTO | null;
  /** Players locked out after a false start: player id -> epoch ms when the lock ends */
  buzzerLocks?: Record<string, number> | null;
  /** "Everyone answers" question (stake / no-risk for everyone) in play */
  allPlay?: AllPlayDataDTO | null;
  /** Final round specific data */
  finalRoundData?: FinalRoundGameData | null;
  /** Which player can pick a question or eliminate theme in final */
  currentTurnPlayerId?: number | null;
  /** Players who have skipped the current question */
  skippedPlayers: number[] | null;
  /** Answer reveal payload visible while the game is in SHOWING_ANSWER. */
  answerShowData?: QuestionFinishEventPayload | QuestionFinishWithAnswerEventPayload | null;
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

import { Game } from "domain/entities/game/Game";
import { type TimerMutation } from "domain/types/action/ActionExecutionContext";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { BroadcastEvent } from "domain/types/service/ServiceResult";

/**
 * All possible game phases (combines QuestionState + game context).
 * More granular than QuestionState to distinguish special cases.
 */
export enum GamePhase {
  // Lobby
  LOBBY = "lobby",

  // Regular round
  CHOOSING = "choosing",
  MEDIA_DOWNLOADING = "media-downloading",
  SHOWING = "showing",
  ANSWERING = "answering",
  SHOWING_ANSWER = "showing-answer",

  // Special questions
  SECRET_QUESTION_TRANSFER = "secret-question-transfer",
  STAKE_BIDDING = "stake-bidding",

  // Final round
  FINAL_THEME_ELIMINATION = "final-theme-elimination",
  FINAL_BIDDING = "final-bidding",
  FINAL_ANSWERING = "final-answering",
  FINAL_REVIEWING = "final-reviewing",

  // End states
  GAME_FINISHED = "game-finished",
}

/**
 * What triggered the transition check.
 * Used for debugging and potentially different behavior per trigger type.
 */
export enum TransitionTrigger {
  /** User performed an action (submitted bid, answered, etc.) */
  USER_ACTION = "user-action",

  /** Timer expired (Redis key expiration) */
  TIMER_EXPIRED = "timer-expired",

  /** Player left the game */
  PLAYER_LEFT = "player-left",

  /** Player disconnected */
  PLAYER_DISCONNECTED = "player-disconnected",

  /** Automatic condition was met (all players answered, etc.) */
  CONDITION_MET = "condition-met",
}

/**
 * Context passed to transition handlers.
 * Contains everything needed to evaluate and execute a transition.
 *
 * NOTE: For regular and final round handlers, check game.gameState conditions, NOT payload.
 * The pattern is: Service mutates game state → Handler checks state → Handler executes transition.
 *
 * Payload is only used for special cases where external data is needed:
 * - Secret question transfer (targetPlayerId)
 * - Stake question bidding (bidAmount)
 */
export interface TransitionContext<
  TPayload extends Record<string, unknown> = Record<string, unknown>
> {
  /** The game entity (will be mutated by handler) */
  game: Game;

  /** What triggered this transition check */
  trigger: TransitionTrigger;

  /** Who/what triggered the transition */
  triggeredBy: {
    playerId?: number;
    socketId?: string;
    /** True if triggered by system (timer, auto-actions) */
    isSystem: boolean;
  };

  /**
   * Optional payload for special cases only.
   * Regular/final round handlers should NOT use this - check game state instead.
   */
  payload?: TPayload;
}

/**
 * Result of a successful transition.
 */
export interface TransitionResult {
  /** Whether transition occurred */
  success: boolean;

  /** Phase before transition */
  fromPhase: GamePhase;

  /** Phase after transition */
  toPhase: GamePhase;

  /** The mutated game entity */
  game: Game;

  /** Broadcasts to emit after transition */
  broadcasts: BroadcastEvent[];

  /** Timer state after transition (nullable but always present) */
  timer: GameStateTimerDTO | null;

  /** Timer mutations to apply in the OUT pipeline (SET/DEL timer keys) */
  timerMutations: TimerMutation[];

  /** Additional data for the caller (handler-specific) */
  data?: unknown; // Caller casts as needed
}

/**
 * Result of state mutations within a transition handler.
 */
export interface MutationResult {
  /** Any data to pass to broadcast building */
  data?: unknown; // Concrete handlers cast internally
}

/**
 * Result of timer handling within a transition handler.
 */
export interface TimerResult {
  /** The new timer, if one was set up */
  timer?: GameStateTimerDTO;

  /** Timer mutations to apply in the OUT pipeline (SET/DEL timer keys) */
  timerMutations: TimerMutation[];
}

/**
 * Resolves the current GamePhase from game state.
 * Centralizes the logic for determining which phase we're in.
 */
export function getGamePhase(game: Game): GamePhase {
  const { questionState, currentRound, stakeQuestionData, secretQuestionData } =
    game.gameState;

  // Game not started or finished
  if (!game.startedAt) {
    return GamePhase.LOBBY;
  }

  if (game.finishedAt) {
    return GamePhase.GAME_FINISHED;
  }

  // Check for special question states first (they override normal phase)
  if (stakeQuestionData?.biddingPhase) {
    return GamePhase.STAKE_BIDDING;
  }

  if (
    secretQuestionData?.transferDecisionPhase &&
    questionState === QuestionState.SECRET_TRANSFER
  ) {
    return GamePhase.SECRET_QUESTION_TRANSFER;
  }

  // Final round phases
  if (currentRound?.type === PackageRoundType.FINAL) {
    switch (questionState) {
      case QuestionState.THEME_ELIMINATION:
        return GamePhase.FINAL_THEME_ELIMINATION;
      case QuestionState.BIDDING:
        return GamePhase.FINAL_BIDDING;
      case QuestionState.ANSWERING:
        return GamePhase.FINAL_ANSWERING;
      case QuestionState.REVIEWING:
        return GamePhase.FINAL_REVIEWING;
    }
  }

  // Regular phases
  switch (questionState) {
    case QuestionState.CHOOSING:
      return GamePhase.CHOOSING;
    case QuestionState.MEDIA_DOWNLOADING:
      return GamePhase.MEDIA_DOWNLOADING;
    case QuestionState.SHOWING:
      return GamePhase.SHOWING;
    case QuestionState.ANSWERING:
      return GamePhase.ANSWERING;
    case QuestionState.SHOWING_ANSWER:
      return GamePhase.SHOWING_ANSWER;
    default:
      return GamePhase.LOBBY;
  }
}

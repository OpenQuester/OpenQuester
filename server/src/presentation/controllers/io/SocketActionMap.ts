import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOEvents, SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameValidator } from "domain/validators/GameValidator";
import {
  type GameJoinInputData,
  type PlayerKickInputData,
  type PlayerRestrictionInputData,
  type PlayerRoleChangeInputData,
  type PlayerScoreChangeInputData,
  type PlayerSlotChangeInputData,
  type QuestionPickInputData,
  type TurnPlayerChangeInputData
} from "domain/types/socket/events/SocketEventInterfaces";
import { type AnswerResultData } from "domain/types/socket/game/AnswerResultData";
import { type AnswerSubmittedData } from "domain/types/socket/game/AnswerSubmittedData";
import { type SecretQuestionTransferInputData } from "domain/types/socket/game/SecretQuestionTransferData";
import { type StakeBidSubmitInputData } from "domain/types/socket/events/game/StakeQuestionEventData";
import {
  type FinalAnswerSubmitInputData,
  type FinalBidSubmitInputData,
  type ThemeEliminateInputData
} from "domain/types/socket/events/FinalRoundEventData";
import { type FinalAnswerReviewInputData } from "domain/types/socket/events/FinalAnswerReviewData";
import { type ChatMessageInputData } from "domain/types/socket/chat/ChatMessageInputData";

// ════════════════════════════════════════════════════════════════════════
//  GameId resolution strategy
// ════════════════════════════════════════════════════════════════════════

/**
 * How the dispatcher resolves the gameId before building the action.
 *
 * - **FROM_SESSION** — `socketGameContextService.getGameIdForSocket(socketId)`.
 *   The standard path for all in-game events.
 * - **FROM_PAYLOAD** — `payload.gameId`. Used only by JoinGame where the
 *   client specifies which game to join.
 * - **FROM_SESSION_SAFE** — like FROM_SESSION but wrapped in try/catch.
 *   Returns `null` on failure instead of throwing. Used by Disconnect
 *   (socket may already be dissociated from a game).
 */
export enum GameIdStrategy {
  FROM_SESSION = "FROM_SESSION",
  FROM_PAYLOAD = "FROM_PAYLOAD"
}

// ════════════════════════════════════════════════════════════════════════
//  Entry type
// ════════════════════════════════════════════════════════════════════════

/**
 * Declarative description of a single socket event → game action mapping.
 *
 * The {@link SocketActionDispatcher} iterates this list and registers
 * one `socket.on(event, ...)` handler per entry.
 */
export interface SocketActionEntry {
  /** Socket.IO event name to listen on */
  readonly event: SocketIOEvents | SocketIOGameEvents;

  /** Game action type dispatched to the executor */
  readonly actionType: GameActionType;

  /** How to resolve the gameId for this event */
  readonly gameIdStrategy: GameIdStrategy;

  /**
   * Joi input validator. When present the dispatcher calls it before
   * building the action; on failure the error is emitted to the socket.
   * When absent the raw payload is forwarded as-is (empty-input events).
   */
  readonly inputValidator?: (data: unknown) => unknown;

  /**
   * When `true` the action is submitted via `submitDirectAction()`,
   * bypassing the lock/queue system. Only for actions that never touch
   * game state (e.g. chat messages).
   */
  readonly directExecution?: boolean;

  /**
   * When `true` a `null` gameId is silently accepted (handler completes
   * as a no-op). Used for Disconnect where the user may not be in a game.
   */
  readonly allowNullGameId?: boolean;
}

// ════════════════════════════════════════════════════════════════════════
//  The map — single source of truth for all socket → action bindings
// ════════════════════════════════════════════════════════════════════════

export const SOCKET_ACTION_MAP: readonly SocketActionEntry[] = [
  // ──────────────── Game Lifecycle ────────────────
  {
    event: SocketIOGameEvents.JOIN,
    actionType: GameActionType.JOIN,
    gameIdStrategy: GameIdStrategy.FROM_PAYLOAD,
    inputValidator: (data) => GameValidator.validateJoinInput(data as GameJoinInputData)
  },
  {
    event: SocketIOGameEvents.LEAVE,
    actionType: GameActionType.LEAVE,
    gameIdStrategy: GameIdStrategy.FROM_SESSION
  },
  {
    event: SocketIOGameEvents.START,
    actionType: GameActionType.START,
    gameIdStrategy: GameIdStrategy.FROM_SESSION
  },
  {
    event: SocketIOGameEvents.GAME_PAUSE,
    actionType: GameActionType.PAUSE,
    gameIdStrategy: GameIdStrategy.FROM_SESSION
  },
  {
    event: SocketIOGameEvents.GAME_UNPAUSE,
    actionType: GameActionType.UNPAUSE,
    gameIdStrategy: GameIdStrategy.FROM_SESSION
  },
  {
    event: SocketIOGameEvents.NEXT_ROUND,
    actionType: GameActionType.NEXT_ROUND,
    gameIdStrategy: GameIdStrategy.FROM_SESSION
  },

  // ──────────────── Player Management ────────────────
  {
    event: SocketIOGameEvents.PLAYER_READY,
    actionType: GameActionType.PLAYER_READY,
    gameIdStrategy: GameIdStrategy.FROM_SESSION
  },
  {
    event: SocketIOGameEvents.PLAYER_UNREADY,
    actionType: GameActionType.PLAYER_UNREADY,
    gameIdStrategy: GameIdStrategy.FROM_SESSION
  },
  {
    event: SocketIOGameEvents.TURN_PLAYER_CHANGED,
    actionType: GameActionType.TURN_PLAYER_CHANGE,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) =>
      GameValidator.validateTurnPlayerChange(data as TurnPlayerChangeInputData)
  },
  {
    event: SocketIOGameEvents.SCORE_CHANGED,
    actionType: GameActionType.PLAYER_SCORE_CHANGE,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) =>
      GameValidator.validatePlayerScoreChange(data as PlayerScoreChangeInputData)
  },
  {
    event: SocketIOGameEvents.PLAYER_ROLE_CHANGE,
    actionType: GameActionType.PLAYER_ROLE_CHANGE,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) =>
      GameValidator.validatePlayerRoleChange(data as PlayerRoleChangeInputData)
  },
  {
    event: SocketIOGameEvents.PLAYER_RESTRICTED,
    actionType: GameActionType.PLAYER_RESTRICTION,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) =>
      GameValidator.validatePlayerRestriction(data as PlayerRestrictionInputData)
  },
  {
    event: SocketIOGameEvents.PLAYER_KICKED,
    actionType: GameActionType.PLAYER_KICK,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) => GameValidator.validatePlayerKick(data as PlayerKickInputData)
  },
  {
    event: SocketIOGameEvents.PLAYER_SLOT_CHANGE,
    actionType: GameActionType.PLAYER_SLOT_CHANGE,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) =>
      GameValidator.validatePlayerSlotChange(data as PlayerSlotChangeInputData)
  },

  // ──────────────── Question ────────────────
  {
    event: SocketIOGameEvents.QUESTION_PICK,
    actionType: GameActionType.QUESTION_PICK,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) => GameValidator.validatePickQuestion(data as QuestionPickInputData)
  },
  {
    event: SocketIOGameEvents.QUESTION_ANSWER,
    actionType: GameActionType.QUESTION_ANSWER,
    gameIdStrategy: GameIdStrategy.FROM_SESSION
  },
  {
    event: SocketIOGameEvents.ANSWER_RESULT,
    actionType: GameActionType.ANSWER_RESULT,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) => GameValidator.validateAnswerResult(data as AnswerResultData)
  },
  {
    event: SocketIOGameEvents.ANSWER_SUBMITTED,
    actionType: GameActionType.ANSWER_SUBMITTED,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) => GameValidator.validateAnswerSubmitted(data as AnswerSubmittedData)
  },
  {
    event: SocketIOGameEvents.QUESTION_SKIP,
    actionType: GameActionType.QUESTION_SKIP,
    gameIdStrategy: GameIdStrategy.FROM_SESSION
  },
  {
    event: SocketIOGameEvents.QUESTION_UNSKIP,
    actionType: GameActionType.QUESTION_UNSKIP,
    gameIdStrategy: GameIdStrategy.FROM_SESSION
  },
  {
    event: SocketIOGameEvents.SKIP_QUESTION_FORCE,
    actionType: GameActionType.SKIP_QUESTION_FORCE,
    gameIdStrategy: GameIdStrategy.FROM_SESSION
  },
  {
    event: SocketIOGameEvents.SKIP_SHOW_ANSWER,
    actionType: GameActionType.SKIP_SHOW_ANSWER,
    gameIdStrategy: GameIdStrategy.FROM_SESSION
  },
  {
    event: SocketIOGameEvents.SECRET_QUESTION_TRANSFER,
    actionType: GameActionType.SECRET_QUESTION_TRANSFER,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) =>
      GameValidator.validateSecretQuestionTransfer(data as SecretQuestionTransferInputData)
  },
  {
    event: SocketIOGameEvents.STAKE_BID_SUBMIT,
    actionType: GameActionType.STAKE_BID_SUBMIT,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) => GameValidator.validateStakeBid(data as StakeBidSubmitInputData)
  },

  // ──────────────── Final Round ────────────────
  {
    event: SocketIOGameEvents.THEME_ELIMINATE,
    actionType: GameActionType.THEME_ELIMINATE,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) =>
      GameValidator.validateThemeElimination(data as ThemeEliminateInputData)
  },
  {
    event: SocketIOGameEvents.FINAL_BID_SUBMIT,
    actionType: GameActionType.FINAL_BID_SUBMIT,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) => GameValidator.validateBid(data as FinalBidSubmitInputData)
  },
  {
    event: SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
    actionType: GameActionType.FINAL_ANSWER_SUBMIT,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) =>
      GameValidator.validateFinalAnswerSubmit(data as FinalAnswerSubmitInputData)
  },
  {
    event: SocketIOGameEvents.FINAL_ANSWER_REVIEW,
    actionType: GameActionType.FINAL_ANSWER_REVIEW,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) =>
      GameValidator.validateFinalAnswerReview(data as FinalAnswerReviewInputData)
  },

  // ──────────────── Media ────────────────
  {
    event: SocketIOGameEvents.MEDIA_DOWNLOADED,
    actionType: GameActionType.MEDIA_DOWNLOADED,
    gameIdStrategy: GameIdStrategy.FROM_SESSION
  },

  // ──────────────── System ────────────────
  {
    event: SocketIOEvents.CHAT_MESSAGE,
    actionType: GameActionType.CHAT_MESSAGE,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    inputValidator: (data) => GameValidator.validateChatMessage(data as ChatMessageInputData),
    directExecution: true
  },
  {
    event: SocketIOEvents.DISCONNECT,
    actionType: GameActionType.DISCONNECT,
    gameIdStrategy: GameIdStrategy.FROM_SESSION,
    allowNullGameId: true
  }
] as const;

/**
 * Dedicated interfaces for socket event input/output data
 * Provides strict typing without indexed access patterns
 */

import { ChatMessageGamePayloadDTO } from "domain/types/dto/game/chat/ChatMessageEventPayloadDTO";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { UserDTO } from "domain/types/dto/user/UserDTO";
import { NotificationType } from "domain/enums/NotificationType";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { GameJoinMeta } from "domain/types/socket/events/game/GameJoinMeta";

/**
 * Input data interfaces for socket events
 */
export interface GameJoinInputData {
  gameId: string;
  role: PlayerRole;
  /**
   * Target slot for player role.
   * If null, first available slot will be assigned.
   * Only applicable when role is PLAYER.
   */
  targetSlot: number | null;
}

export interface ChatMessageInputData {
  message: string;
}

export interface QuestionPickInputData {
  questionId: number;
}

export interface AnswerSubmittedInputData {
  answerText: string | null;
}

/**
 * Player management input data interfaces
 */
export interface PlayerRoleChangeInputData {
  playerId: number | null;
  newRole: PlayerRole;
}

export interface PlayerRestrictionInputData {
  playerId: number;
  muted: boolean;
  restricted: boolean;
  banned: boolean;
}

export interface PlayerKickInputData {
  playerId: number;
}

export interface PlayerScoreChangeInputData {
  playerId: number;
  newScore: number;
}

export interface TurnPlayerChangeInputData {
  newTurnPlayerId: number | null;
}

export interface PlayerSlotChangeInputData {
  targetSlot: number;
  playerId?: number;
}

// Empty interfaces for events without input data

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EmptyInputData {
  //
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EmptyOutputData {
  //
}

/**
 * Output/broadcast data interfaces for socket events
 */
export interface GameJoinOutputData {
  meta: GameJoinMeta;
  players: PlayerDTO[];
  gameState: GameStateDTO;
  chatMessages: ChatMessageGamePayloadDTO[];
}

export interface GameLeaveBroadcastData {
  user: number;
}

export interface GameStartBroadcastData {
  currentRound: GameStateRoundDTO;
}

export interface GamePauseBroadcastData {
  timer: GameStateTimerDTO | null;
}

export interface GameUnpauseBroadcastData {
  timer: GameStateTimerDTO | null;
}

export interface AnswerSubmittedBroadcastData {
  answerText: string | null;
}

export interface QuestionSkipBroadcastData {
  playerId: number;
}

export interface QuestionUnskipBroadcastData {
  playerId: number;
}

export interface PlayerReadinessBroadcastData {
  playerId: number;
  isReady: boolean;
  readyPlayers: number[];
  autoStartTriggered?: boolean;
}

export interface ChatMessageBroadcastData {
  uuid: string;
  timestamp: Date;
  user: number;
  message: string;
}

/**
 * User notification event interfaces
 */
export interface UserChangeBroadcastData {
  userData: UserDTO;
}

export interface GameExpirationWarningNotificationData {
  gameId: string;
  expiresAt: Date;
}

export interface NotificationBroadcastData {
  type: NotificationType;
  data: GameExpirationWarningNotificationData;
}

/**
 * Player management broadcast data interfaces
 */
export interface PlayerRoleChangeBroadcastData {
  playerId: number;
  newRole: PlayerRole;
  /**
   * Include all players for cases if player role changed to player
   * so we can see slot and other info
   */
  players: PlayerDTO[];
}

export interface PlayerRestrictionBroadcastData {
  playerId: number;
  muted: boolean;
  restricted: boolean;
  banned: boolean;
}

export interface PlayerKickBroadcastData {
  playerId: number;
}

export interface PlayerScoreChangeBroadcastData {
  playerId: number;
  newScore: number;
}

export interface TurnPlayerChangeBroadcastData {
  newTurnPlayerId: number | null;
}

export interface PlayerSlotChangeBroadcastData {
  playerId: number;
  newSlot: number;
  /** Include all players to synchronize data */
  players: PlayerDTO[];
}

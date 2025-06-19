/**
 * Dedicated interfaces for socket event input/output data
 * Provides strict typing without indexed access patterns
 */

import { ChatMessageGamePayloadDTO } from "domain/types/dto/game/chat/ChatMessageEventPayloadDTO";
import { PlayerDTO } from "domain/types/dto/game/player/PlayerDTO";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { GameStateRoundDTO } from "domain/types/dto/game/state/GameStateRoundDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PlayerRole } from "domain/types/game/PlayerRole";

/**
 * Input data interfaces for socket events
 */
export interface GameJoinInputData {
  gameId: string;
  role: PlayerRole;
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
  meta: {
    title: string;
  };
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

export interface ChatMessageBroadcastData {
  uuid: string;
  timestamp: Date;
  user: number;
  message: string;
}

import { type GameActionType } from "domain/enums/GameActionType";
import { type GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";

export interface WaitForSubmittedActionsOptions {
  readonly gameId: string;
  readonly expectedCount: number;
  readonly actionType?: GameActionType;
  readonly timeoutMs?: number;
}

export interface WaitForActionsCompleteOptions {
  readonly gameId: string;
  readonly timeoutMs?: number;
}

/**
 * Minimal driver contract for scenario tests.
 *
 * The first implementation wraps the current Node/Socket.IO test utils. Future
 * engine migrations can provide another driver while keeping scenario tests
 * focused on client-visible behavior.
 */
export interface ScenarioGameDriver {
  getGameState(gameId: string): Promise<GameStateDTO | null>;
  getFirstAvailableQuestionId(gameId: string): Promise<number>;
  waitForSubmittedActions(options: WaitForSubmittedActionsOptions): Promise<void>;
  waitForActionsComplete(options: WaitForActionsCompleteOptions): Promise<void>;
}

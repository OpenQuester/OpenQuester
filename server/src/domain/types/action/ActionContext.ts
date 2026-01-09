import { GameAction } from "domain/types/action/GameAction";

/**
 * Minimal context for action execution.
 * Carries only identifiers to rehydrate game state inside services.
 */
export interface ActionContext {
  gameId: string;
  playerId: number;
  socketId: string;
}

/**
 * Builds ActionContext from GameAction to avoid refetching socket session.
 */
export function createActionContextFromAction(
  action: GameAction
): ActionContext {
  return {
    gameId: action.gameId,
    playerId: action.playerId,
    socketId: action.socketId,
  };
}

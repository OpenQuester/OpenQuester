import { Game } from "domain/entities/game/Game";
import { DataMutation } from "domain/types/action/DataMutation";
import { BroadcastEvent } from "domain/types/service/ServiceResult";

export interface PlayerLeaveStrategyResult {
  mutations: DataMutation[];
  broadcasts: BroadcastEvent[];
}

export interface IPlayerLeaveStrategy {
  /** Returns true if this strategy applies to the current game state and player */
  canHandle(game: Game, userId: number): boolean;

  /** Executes the leave logic and returns mutations/broadcasts */
  execute(game: Game, userId: number): Promise<PlayerLeaveStrategyResult>;
}

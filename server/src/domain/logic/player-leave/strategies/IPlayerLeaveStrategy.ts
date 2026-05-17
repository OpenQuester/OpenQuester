import { Game } from "domain/entities/game/Game";
import { type TransitionResources } from "domain/state-machine/types";
import { DataMutation } from "domain/types/action/DataMutation";
import { BroadcastEvent } from "domain/types/service/ServiceResult";

export interface PlayerLeaveStrategyResult {
  mutations: DataMutation[];
  broadcasts: BroadcastEvent[];
}

export interface StakeBiddingLeaveInput {
  minimumBid: number;
}

export interface PlayerLeaveStrategyInput {
  game: Game;
  userId: number;
  stakeBidding?: StakeBiddingLeaveInput;
  transitionResources?: TransitionResources;
}

export interface IPlayerLeaveStrategy {
  /** Returns true if this strategy applies to the current game state and player */
  canHandle(input: PlayerLeaveStrategyInput): boolean;

  /** Executes the leave logic and returns mutations/broadcasts */
  execute(input: PlayerLeaveStrategyInput): Promise<PlayerLeaveStrategyResult>;
}

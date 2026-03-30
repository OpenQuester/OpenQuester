import { singleton } from "tsyringe";

import { Game } from "domain/entities/game/Game";
import { FinalBiddingPlayerLeaveLogic } from "domain/logic/player-leave/FinalBiddingPlayerLeaveLogic";
import {
  IPlayerLeaveStrategy,
  PlayerLeaveStrategyResult,
} from "domain/logic/player-leave/strategies/IPlayerLeaveStrategy";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { DataMutationConverter } from "domain/types/action/DataMutation";

@singleton()
export class FinalBiddingLeaveStrategy implements IPlayerLeaveStrategy {
  constructor(private readonly phaseTransitionRouter: PhaseTransitionRouter) {}

  public canHandle(game: Game, userId: number): boolean {
    return FinalBiddingPlayerLeaveLogic.validate(game, userId).isEligible;
  }

  public async execute(
    game: Game,
    userId: number
  ): Promise<PlayerLeaveStrategyResult> {
    const mutationResult = FinalBiddingPlayerLeaveLogic.processAutoBid(
      game,
      userId
    );

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.PLAYER_LEFT,
      triggeredBy: { playerId: userId, isSystem: false },
    });

    const logicResult = FinalBiddingPlayerLeaveLogic.buildResult({
      game,
      mutationResult,
      transitionResult,
    });

    const result: PlayerLeaveStrategyResult = {
      mutations: [],
      broadcasts: logicResult.broadcasts,
    };

    if (transitionResult) {
      result.mutations.push(
        ...DataMutationConverter.mutationFromTimerMutations(
          transitionResult.timerMutations
        )
      );
    }

    return result;
  }
}

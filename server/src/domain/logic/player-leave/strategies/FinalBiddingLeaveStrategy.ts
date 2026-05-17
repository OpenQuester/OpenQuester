import { singleton } from "tsyringe";

import { FinalBiddingPlayerLeaveLogic } from "domain/logic/player-leave/FinalBiddingPlayerLeaveLogic";
import {
  IPlayerLeaveStrategy,
  PlayerLeaveStrategyInput,
  PlayerLeaveStrategyResult,
} from "domain/logic/player-leave/strategies/IPlayerLeaveStrategy";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import {
  type TransitionContext,
  TransitionTrigger,
} from "domain/state-machine/types";
import { DataMutationConverter } from "domain/types/action/DataMutation";

@singleton()
export class FinalBiddingLeaveStrategy implements IPlayerLeaveStrategy {
  constructor(private readonly phaseTransitionRouter: PhaseTransitionRouter) {}

  public canHandle(input: PlayerLeaveStrategyInput): boolean {
    const { game, userId } = input;
    return FinalBiddingPlayerLeaveLogic.validate(game, userId).isEligible;
  }

  public async execute(
    input: PlayerLeaveStrategyInput
  ): Promise<PlayerLeaveStrategyResult> {
    const { game, userId, transitionResources } = input;
    const mutationResult = FinalBiddingPlayerLeaveLogic.processAutoBid(
      game,
      userId
    );

    const transitionContext: TransitionContext = {
      game,
      trigger: TransitionTrigger.PLAYER_LEFT,
      triggeredBy: { playerId: userId, isSystem: false },
    };

    if (transitionResources) {
      transitionContext.resources = transitionResources;
    }

    const transitionResult = await this.phaseTransitionRouter.tryTransition(
      transitionContext
    );

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

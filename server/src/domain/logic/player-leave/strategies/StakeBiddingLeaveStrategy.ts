import { singleton } from "tsyringe";

import { timerKey } from "domain/constants/redisKeys";
import { StakeBiddingPlayerLeaveLogic } from "domain/logic/player-leave/StakeBiddingPlayerLeaveLogic";
import {
  IPlayerLeaveStrategy,
  PlayerLeaveStrategyInput,
  PlayerLeaveStrategyResult
} from "domain/logic/player-leave/strategies/IPlayerLeaveStrategy";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import {
  type TransitionContext,
  TransitionTrigger,
} from "domain/state-machine/types";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { StakeBiddingToAnsweringPayload } from "domain/types/socket/transition/special-question";
import { ServerError } from "domain/errors/ServerError";

@singleton()
export class StakeBiddingLeaveStrategy implements IPlayerLeaveStrategy {
  constructor(private readonly phaseTransitionRouter: PhaseTransitionRouter) {
    //
  }

  public canHandle(input: PlayerLeaveStrategyInput): boolean {
    const { game, userId } = input;
    return StakeBiddingPlayerLeaveLogic.validate(game, userId).isEligible;
  }

  public async execute(input: PlayerLeaveStrategyInput): Promise<PlayerLeaveStrategyResult> {
    const { game, userId, stakeBidding } = input;

    if (!stakeBidding) {
      throw new ServerError("Stake bidding leave requires minimum bid");
    }

    const mutationResult = StakeBiddingPlayerLeaveLogic.processAutoPass(
      game,
      userId,
      stakeBidding.minimumBid
    );

    const result: PlayerLeaveStrategyResult = {
      mutations: [],
      broadcasts: []
    };

    if (mutationResult.questionSkipped) {
      StakeBiddingPlayerLeaveLogic.handleQuestionSkip(game);
      result.mutations.push(DataMutationConverter.deleteTimerMutation(timerKey(game.id)));

      const logicResult = StakeBiddingPlayerLeaveLogic.buildResult({
        game,
        mutationResult
      });
      result.broadcasts.push(...logicResult.broadcasts);
      return result;
    }

    const logicResult = StakeBiddingPlayerLeaveLogic.buildResult({
      game,
      mutationResult
    });
    result.broadcasts.push(...logicResult.broadcasts);

    if (mutationResult.isBiddingComplete && mutationResult.winnerId !== null) {
      const transitionContext: TransitionContext<StakeBiddingToAnsweringPayload> = {
        game,
        trigger: TransitionTrigger.PLAYER_LEFT,
        triggeredBy: { playerId: userId, isSystem: false },
        payload: {
          isPhaseComplete: true,
          winnerPlayerId: mutationResult.winnerId,
          finalBid: mutationResult.winningBid
        } satisfies StakeBiddingToAnsweringPayload
      };

      if (input.transitionResources) {
        transitionContext.resources = input.transitionResources;
      }

      const transitionResult = await this.phaseTransitionRouter.tryTransition(
        transitionContext
      );

      if (transitionResult) {
        result.broadcasts.push(...transitionResult.broadcasts);
        result.mutations.push(
          ...DataMutationConverter.mutationFromTimerMutations(transitionResult.timerMutations)
        );
      }
    }

    return result;
  }
}

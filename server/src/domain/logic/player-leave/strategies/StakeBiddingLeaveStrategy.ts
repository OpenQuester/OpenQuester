import { singleton } from "tsyringe";

import { timerKey } from "domain/constants/redisKeys";
import { Game } from "domain/entities/game/Game";
import { StakeBiddingPlayerLeaveLogic } from "domain/logic/player-leave/StakeBiddingPlayerLeaveLogic";
import {
  IPlayerLeaveStrategy,
  PlayerLeaveStrategyResult,
} from "domain/logic/player-leave/strategies/IPlayerLeaveStrategy";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { StakeBiddingToAnsweringPayload } from "domain/types/socket/transition/special-question";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

@singleton()
export class StakeBiddingLeaveStrategy implements IPlayerLeaveStrategy {
  constructor(
    private readonly packageStore: PackageStore,
    private readonly phaseTransitionRouter: PhaseTransitionRouter
  ) {
    //
  }

  public canHandle(game: Game, userId: number): boolean {
    return StakeBiddingPlayerLeaveLogic.validate(game, userId).isEligible;
  }

  public async execute(
    game: Game,
    userId: number
  ): Promise<PlayerLeaveStrategyResult> {
    const stakeData = game.gameState.stakeQuestionData!;
    const stakeQuestion = await this.packageStore.getQuestion(
      game.id,
      stakeData.questionId
    );
    const questionPrice = stakeQuestion?.price ?? 0;

    const mutationResult = StakeBiddingPlayerLeaveLogic.processAutoPass(
      game,
      userId,
      questionPrice
    );

    const result: PlayerLeaveStrategyResult = {
      mutations: [],
      broadcasts: [],
    };

    if (mutationResult.questionSkipped) {
      StakeBiddingPlayerLeaveLogic.handleQuestionSkip(game);
      result.mutations.push(
        DataMutationConverter.deleteTimerMutation(timerKey(game.id))
      );

      const logicResult = StakeBiddingPlayerLeaveLogic.buildResult({
        game,
        mutationResult,
      });
      result.broadcasts.push(...logicResult.broadcasts);
      return result;
    }

    const logicResult = StakeBiddingPlayerLeaveLogic.buildResult({
      game,
      mutationResult,
    });
    result.broadcasts.push(...logicResult.broadcasts);

    if (mutationResult.isBiddingComplete && mutationResult.winnerId !== null) {
      const transitionResult = await this.phaseTransitionRouter.tryTransition({
        game,
        trigger: TransitionTrigger.PLAYER_LEFT,
        triggeredBy: { playerId: userId, isSystem: false },
        payload: {
          isPhaseComplete: true,
          winnerPlayerId: mutationResult.winnerId,
          finalBid: mutationResult.winningBid,
        } satisfies StakeBiddingToAnsweringPayload,
      });

      if (transitionResult) {
        result.broadcasts.push(...transitionResult.broadcasts);
        result.mutations.push(
          ...DataMutationConverter.mutationFromTimerMutations(
            transitionResult.timerMutations
          )
        );
      }
    }

    return result;
  }
}

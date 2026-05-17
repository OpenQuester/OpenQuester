import { singleton } from "tsyringe";

import { MediaDownloadPlayerLeaveLogic } from "domain/logic/player-leave/MediaDownloadPlayerLeaveLogic";
import {
  IPlayerLeaveStrategy,
  PlayerLeaveStrategyInput,
  PlayerLeaveStrategyResult,
} from "domain/logic/player-leave/strategies/IPlayerLeaveStrategy";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { DataMutationConverter } from "domain/types/action/DataMutation";

@singleton()
export class MediaDownloadLeaveStrategy implements IPlayerLeaveStrategy {
  constructor(private readonly phaseTransitionRouter: PhaseTransitionRouter) {}

  public canHandle(input: PlayerLeaveStrategyInput): boolean {
    const { game } = input;
    return MediaDownloadPlayerLeaveLogic.validate(game).isEligible;
  }

  public async execute(
    input: PlayerLeaveStrategyInput
  ): Promise<PlayerLeaveStrategyResult> {
    const { game, userId } = input;
    // Try to transition to showing if this was last player who hasn't downloaded yet
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.PLAYER_LEFT,
      triggeredBy: { playerId: userId, isSystem: false },
    });

    const result: PlayerLeaveStrategyResult = {
      mutations: [],
      broadcasts: [],
    };

    if (transitionResult) {
      const timer = transitionResult.timer ?? null;
      const logicResult = MediaDownloadPlayerLeaveLogic.buildResult({
        game,
        timer,
        leftUserId: userId,
      });

      result.broadcasts.push(...logicResult.broadcasts);
      result.mutations.push(
        ...DataMutationConverter.mutationFromTimerMutations(
          transitionResult.timerMutations
        )
      );
    }

    return result;
  }
}

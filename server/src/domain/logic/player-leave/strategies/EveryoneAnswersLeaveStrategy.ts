import { singleton } from "tsyringe";

import {
  IPlayerLeaveStrategy,
  PlayerLeaveStrategyInput,
  PlayerLeaveStrategyResult
} from "domain/logic/player-leave/strategies/IPlayerLeaveStrategy";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { GamePhase, getGamePhase, TransitionTrigger } from "domain/state-machine/types";
import { DataMutationConverter } from "domain/types/action/DataMutation";

/** Stakes in, then (when everything was judged automatically) the reveal. */
const MAX_STEPS_PER_LEAVE = 2;

/** Phases where an "everyone answers" question waits for every player. */
const WAITING_PHASES = new Set<GamePhase>([GamePhase.ALL_PLAY_BIDDING, GamePhase.SHOWING]);

/**
 * An "everyone answers" question waits for every player still in the game
 * to stake or answer. When the one it waited for leaves, the question moves
 * on now instead of when its timer runs out. Runs after the player is removed.
 */
@singleton()
export class EveryoneAnswersLeaveStrategy implements IPlayerLeaveStrategy {
  constructor(private readonly phaseTransitionRouter: PhaseTransitionRouter) {
    //
  }

  public canHandle(input: PlayerLeaveStrategyInput): boolean {
    const { game } = input;

    return !!game.gameState.allPlay && WAITING_PHASES.has(getGamePhase(game));
  }

  public async execute(input: PlayerLeaveStrategyInput): Promise<PlayerLeaveStrategyResult> {
    const { game, userId, transitionResources } = input;
    const result: PlayerLeaveStrategyResult = { mutations: [], broadcasts: [] };

    for (let step = 0; step < MAX_STEPS_PER_LEAVE; step++) {
      const transition = await this.phaseTransitionRouter.tryTransition({
        game,
        trigger: TransitionTrigger.CONDITION_MET,
        triggeredBy: { playerId: userId, isSystem: true },
        ...(transitionResources ? { resources: transitionResources } : {})
      });

      if (!transition) {
        break;
      }

      result.mutations.push(
        ...DataMutationConverter.mutationFromTimerMutations(transition.timerMutations),
        ...DataMutationConverter.mutationFromServiceBroadcasts(transition.broadcasts, game.id)
      );
    }

    return result;
  }
}

import { QuestionTransitionLogic } from "domain/logic/question/QuestionTransitionLogic";
import { SYSTEM_PLAYER_ID } from "domain/constants/game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { singleton } from "tsyringe";

import { MediaDownloadPlayerLeaveLogic } from "domain/logic/player-leave/MediaDownloadPlayerLeaveLogic";
import {
  IPlayerLeaveStrategy,
  PlayerLeaveStrategyInput,
  PlayerLeaveStrategyResult
} from "domain/logic/player-leave/strategies/IPlayerLeaveStrategy";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { GamePhase, TransitionTrigger } from "domain/state-machine/types";
import { DataMutationConverter } from "domain/types/action/DataMutation";

@singleton()
export class MediaDownloadLeaveStrategy implements IPlayerLeaveStrategy {
  constructor(private readonly phaseTransitionRouter: PhaseTransitionRouter) {}

  public canHandle(input: PlayerLeaveStrategyInput): boolean {
    const { game } = input;
    return MediaDownloadPlayerLeaveLogic.validate(game).isEligible;
  }

  public async execute(input: PlayerLeaveStrategyInput): Promise<PlayerLeaveStrategyResult> {
    const { game, userId } = input;
    const wasReady = game.gameState.questionTransition?.mediaReady;
    const openingMutations = QuestionTransitionLogic.refresh(game);
    // MEDIA_DOWNLOADING -> SHOWING after the regular opening barrier,
    // or MEDIA_DOWNLOADING -> FINAL_ANSWERING when no waiting finalist remains.
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.PLAYER_LEFT,
      triggeredBy: { playerId: userId, isSystem: false }
    });

    const result: PlayerLeaveStrategyResult = {
      mutations: [],
      broadcasts: []
    };

    if (!transitionResult) {
      result.mutations.push(...DataMutationConverter.mutationFromTimerMutations(openingMutations));
      if (wasReady !== game.gameState.questionTransition?.mediaReady) {
        result.broadcasts.push({
          event: SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
          room: game.id,
          data: QuestionTransitionLogic.status(game, SYSTEM_PLAYER_ID, null)
        });
      }
    }

    if (transitionResult) {
      if (transitionResult.toPhase === GamePhase.FINAL_ANSWERING) {
        result.broadcasts.push(...transitionResult.broadcasts);
        result.mutations.push(
          ...DataMutationConverter.mutationFromTimerMutations(transitionResult.timerMutations)
        );
        return result;
      }
      const timer = transitionResult.timer ?? null;
      const logicResult = MediaDownloadPlayerLeaveLogic.buildResult({
        game,
        timer,
        leftUserId: userId
      });

      result.broadcasts.push(...logicResult.broadcasts);
      result.mutations.push(
        ...DataMutationConverter.mutationFromTimerMutations(transitionResult.timerMutations)
      );
    }

    return result;
  }
}

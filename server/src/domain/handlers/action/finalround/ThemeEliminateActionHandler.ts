import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalRoundHandler } from "domain/handlers/socket/round/FinalRoundHandler";
import { ThemeEliminateLogic } from "domain/logic/final-round/ThemeEliminateLogic";
import { BiddingInitializationLogic } from "domain/state-machine/logic/BiddingInitializationLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  type DataMutation,
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import {
  FinalBidSubmitOutputData,
  FinalPhaseCompleteEventData,
  FinalQuestionEventData,
  ThemeEliminateInputData,
  ThemeEliminateOutputData,
} from "domain/types/socket/events/FinalRoundEventData";

/**
 * Stateless action handler for final round theme elimination.
 * Uses prefetched ctx.game and ctx.currentPlayer — no Redis re-fetch.
 * Inlines bidding phase initialization to avoid re-fetching game.
 */
export class ThemeEliminateActionHandler
  implements
    GameActionHandler<ThemeEliminateInputData, ThemeEliminateOutputData>
{
  constructor(
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly roundHandlerFactory: RoundHandlerFactory
  ) {}

  public async execute(
    ctx: ActionExecutionContext<ThemeEliminateInputData>
  ): Promise<ActionHandlerResult<ThemeEliminateOutputData>> {
    const { game, currentPlayer, action } = ctx;

    const finalRoundHandler = this.roundHandlerFactory.create(
      PackageRoundType.FINAL
    ) as FinalRoundHandler;

    ThemeEliminateLogic.validate({
      game,
      player: currentPlayer,
      themeId: action.payload.themeId,
      finalRoundHandler,
    });

    const mutationResult = ThemeEliminateLogic.eliminateTheme(
      game,
      action.payload.themeId,
      finalRoundHandler
    );

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { playerId: currentPlayer!.meta.id, isSystem: false },
    });

    const result = ThemeEliminateLogic.buildResult({
      game,
      eliminatedBy: currentPlayer!.meta.id,
      themeId: action.payload.themeId,
      mutationResult,
      transitionResult,
    });

    // Start with broadcasts from the result (includes THEME_ELIMINATE + transition broadcasts)
    const mutations: DataMutation[] = [
      DataMutationConverter.saveGameMutation(game),
      ...DataMutationConverter.mutationFromTimerMutations(
        transitionResult?.timerMutations
      ),
      ...DataMutationConverter.mutationFromSocketBroadcasts(result.broadcasts),
    ];

    // If phase is complete (moved to bidding), inline bidding phase initialization
    if (result.isPhaseComplete) {
      const biddingMutationResult =
        BiddingInitializationLogic.processAutomaticBids(game);

      const biddingTransitionResult =
        await this.phaseTransitionRouter.tryTransition({
          game,
          trigger: TransitionTrigger.CONDITION_MET,
          triggeredBy: { isSystem: true },
        });

      const biddingPhaseResult = BiddingInitializationLogic.buildResult({
        game,
        mutationResult: biddingMutationResult,
        transitionResult: biddingTransitionResult,
      });

      mutations.push(
        ...DataMutationConverter.mutationFromTimerMutations(
          biddingTransitionResult?.timerMutations
        )
      );

      // Add automatic bid events
      for (const autoBid of biddingPhaseResult.automaticBids) {
        mutations.push(
          DataMutationConverter.gameBroadcastMutation(
            game.id,
            SocketIOGameEvents.FINAL_BID_SUBMIT,
            {
              playerId: autoBid.playerId,
              bidAmount: autoBid.bidAmount,
              isAutomatic: true,
            } satisfies FinalBidSubmitOutputData
          )
        );
      }

      // If all players auto-bid, emit question data and bidding → answering transition
      if (biddingPhaseResult.questionData) {
        mutations.push(
          DataMutationConverter.gameBroadcastMutation(
            game.id,
            SocketIOGameEvents.FINAL_QUESTION_DATA,
            {
              questionData: biddingPhaseResult.questionData,
            } satisfies FinalQuestionEventData
          )
        );

        mutations.push(
          DataMutationConverter.gameBroadcastMutation(
            game.id,
            SocketIOGameEvents.FINAL_PHASE_COMPLETE,
            {
              phase: FinalRoundPhase.BIDDING,
              nextPhase: FinalRoundPhase.ANSWERING,
              timer: biddingPhaseResult.timer,
            } satisfies FinalPhaseCompleteEventData
          )
        );
      }
    }

    return {
      success: true,
      data: result.data,
      mutations,
      broadcastGame: game,
    };
  }
}

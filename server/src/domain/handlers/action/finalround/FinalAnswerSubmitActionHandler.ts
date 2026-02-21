import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { FinalAnswerLossReason } from "domain/enums/FinalRoundTypes";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { FinalAnswerSubmitLogic } from "domain/logic/final-round/FinalAnswerSubmitLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutation,
  DataMutationConverter,
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionAction } from "domain/types/game/QuestionAction";
import {
  FinalAnswerSubmitInputData,
  FinalAnswerSubmitOutputData,
  FinalSubmitEndEventData,
  SocketIOFinalAutoLossEventPayload,
} from "domain/types/socket/events/FinalRoundEventData";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Stateless action handler for final round answer submission.
 * Uses prefetched ctx.game and ctx.currentPlayer — no Redis re-fetch.
 */
export class FinalAnswerSubmitActionHandler
  implements
    GameActionHandler<FinalAnswerSubmitInputData, FinalAnswerSubmitOutputData>
{
  constructor(
    private readonly socketGameValidationService: SocketGameValidationService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter
  ) {}

  public async execute(
    ctx: ActionExecutionContext<FinalAnswerSubmitInputData>
  ): Promise<ActionHandlerResult<FinalAnswerSubmitOutputData>> {
    const { game, currentPlayer, action } = ctx;

    GameStateValidator.validateGameInProgress(game);
    this.socketGameValidationService.validateQuestionAction(
      currentPlayer,
      game,
      QuestionAction.SUBMIT_ANSWER
    );
    this.socketGameValidationService.validateFinalAnswerSubmission(
      game,
      currentPlayer!
    );

    const player = currentPlayer!;

    const mutationResult = FinalAnswerSubmitLogic.addAnswer(
      game,
      player.meta.id,
      action.payload.answerText
    );

    const completionResult = FinalAnswerSubmitLogic.checkPhaseCompletion(game);

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { playerId: player.meta.id, isSystem: false },
    });

    // If all answers are reviewed (all auto-loss), immediately transition to game finish
    const finishTimerMutations: DataMutation[] = [];
    if (
      transitionResult &&
      FinalRoundStateManager.areAllAnswersReviewed(game)
    ) {
      const finishTransitionResult =
        await this.phaseTransitionRouter.tryTransition({
          game,
          trigger: TransitionTrigger.USER_ACTION,
          triggeredBy: { playerId: player.meta.id, isSystem: false },
        });

      if (finishTransitionResult) {
        transitionResult.broadcasts.push(...finishTransitionResult.broadcasts);
        finishTimerMutations.push(
          ...DataMutationConverter.mutationFromTimerMutations(
            finishTransitionResult.timerMutations
          )
        );
      }
    }

    const result = FinalAnswerSubmitLogic.buildResult({
      game,
      player,
      mutationResult,
      completionResult,
      transitionResult,
    });

    const outputData: FinalAnswerSubmitOutputData = {
      playerId: result.playerId,
    };

    const mutations: DataMutation[] = [
      DataMutationConverter.saveGameMutation(game),
      ...DataMutationConverter.mutationFromTimerMutations(
        transitionResult?.timerMutations
      ),
      ...finishTimerMutations,
      DataMutationConverter.gameBroadcastMutation(
        game.id,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        outputData
      ),
    ];

    if (result.isAutoLoss) {
      mutations.push(
        DataMutationConverter.gameBroadcastMutation(
          game.id,
          SocketIOGameEvents.FINAL_AUTO_LOSS,
          {
            playerId: result.playerId,
            reason: FinalAnswerLossReason.EMPTY_ANSWER,
          } satisfies SocketIOFinalAutoLossEventPayload
        )
      );
    }

    if (result.isPhaseComplete) {
      mutations.push(
        DataMutationConverter.gameBroadcastMutation(
          game.id,
          SocketIOGameEvents.FINAL_SUBMIT_END,
          {
            phase: FinalRoundPhase.ANSWERING,
            nextPhase: FinalRoundPhase.REVIEWING,
            allReviews: result.allReviews,
          } satisfies FinalSubmitEndEventData
        )
      );
    }

    return {
      success: true,
      data: outputData,
      mutations,
      broadcastGame: game,
    };
  }
}

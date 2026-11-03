import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { timerKey } from "domain/constants/redisKeys";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { FinalAnswerLossReason } from "domain/enums/FinalRoundTypes";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { FinalAnswerSubmitLogic } from "domain/logic/final-round/FinalAnswerSubmitLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger, type TransitionResult } from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { type DataMutation, DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionAction } from "domain/types/game/QuestionAction";
import {
  FinalAnswerSubmitInputData,
  FinalAnswerSubmitOutputData,
  FinalSubmitEndEventData,
  SocketIOFinalAutoLossEventPayload
} from "domain/types/socket/events/FinalRoundEventData";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { FinalQuestionPlaybackLogic } from "domain/logic/final-round/FinalQuestionPlaybackLogic";
import { ClientError } from "domain/errors/ClientError";
import { ClientResponse } from "domain/enums/ClientResponse";

/**
 * Handles final round answer submission.
 * Uses prefetched ctx.game and ctx.currentPlayer — no Redis re-fetch.
 */
export class FinalAnswerSubmitUseCase implements GameActionHandler<
  FinalAnswerSubmitInputData,
  FinalAnswerSubmitOutputData
> {
  constructor(
    private readonly socketGameValidationService: SocketGameValidationService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly transitionResourceService: TransitionResourceService
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
    this.socketGameValidationService.validateFinalAnswerSubmission(game, currentPlayer!);

    if (!FinalQuestionPlaybackLogic.isPlaybackComplete(game)) {
      throw new ClientError(ClientResponse.CANNOT_SUBMIT_ANSWER);
    }

    const player = currentPlayer!;

    const mutationResult = FinalAnswerSubmitLogic.addAnswer(
      game,
      player.meta.id,
      action.payload.answerText
    );

    // This helper enters FINAL_REVIEWING and settles auto-losses when all answers are in.
    const completionResult = FinalAnswerSubmitLogic.checkPhaseCompletion(game);

    if (completionResult.isPhaseComplete) {
      game.gameState.timer = null;
    }
    let finishTransition: TransitionResult | null = null;
    if (completionResult.isPhaseComplete && FinalRoundStateManager.areAllAnswersReviewed(game)) {
      // Transition from FINAL_REVIEWING to GAME_FINISHED when every answer is an auto-loss.
      finishTransition = await this.phaseTransitionRouter.tryTransition({
        game,
        trigger: TransitionTrigger.USER_ACTION,
        triggeredBy: { playerId: player.meta.id, isSystem: false },
        resources: await this.transitionResourceService.getFinalReviewingToGameFinishResources(game)
      });
    }

    const result = FinalAnswerSubmitLogic.buildResult({
      game,
      player,
      mutationResult,
      completionResult,
      transitionResult: finishTransition
    });

    const outputData: FinalAnswerSubmitOutputData = {
      playerId: result.playerId
    };

    const mutations: DataMutation[] = [
      DataMutationConverter.saveGameMutation(game),
      ...DataMutationConverter.mutationFromTimerMutations(finishTransition?.timerMutations),
      DataMutationConverter.gameBroadcastMutation(
        game.id,
        SocketIOGameEvents.FINAL_ANSWER_SUBMIT,
        outputData
      )
    ];

    if (result.isAutoLoss) {
      mutations.push(
        DataMutationConverter.gameBroadcastMutation(game.id, SocketIOGameEvents.FINAL_AUTO_LOSS, {
          playerId: result.playerId,
          reason: FinalAnswerLossReason.EMPTY_ANSWER
        } satisfies SocketIOFinalAutoLossEventPayload)
      );
    }

    if (result.isPhaseComplete) {
      if (!finishTransition) {
        mutations.push(DataMutationConverter.deleteTimerMutation(timerKey(game.id)));
      }
      mutations.push(
        DataMutationConverter.gameBroadcastMutation(game.id, SocketIOGameEvents.FINAL_SUBMIT_END, {
          phase: FinalRoundPhase.ANSWERING,
          nextPhase: FinalRoundPhase.REVIEWING,
          bids: { ...game.gameState.finalRoundData?.bids },
          allReviews: result.allReviews
        } satisfies FinalSubmitEndEventData)
      );
    }

    if (finishTransition?.success) {
      mutations.push(
        DataMutationConverter.gameCompletionMutation(game.id),
        ...DataMutationConverter.mutationFromServiceBroadcasts(finishTransition.broadcasts, game.id)
      );
    }

    return {
      success: true,
      data: outputData,
      mutations,
      broadcastGame: game
    };
  }
}

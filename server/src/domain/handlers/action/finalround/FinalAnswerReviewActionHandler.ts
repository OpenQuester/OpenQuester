import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { FinalAnswerReviewLogic } from "domain/state-machine/logic/FinalAnswerReviewLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  type DataMutation,
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionAction } from "domain/types/game/QuestionAction";
import {
  FinalAnswerReviewInputData,
  FinalAnswerReviewOutputData,
} from "domain/types/socket/events/FinalAnswerReviewData";
import { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Stateless action handler for final round answer review.
 * Uses prefetched ctx.game and ctx.currentPlayer — no Redis re-fetch.
 */
export class FinalAnswerReviewActionHandler
  implements
    GameActionHandler<FinalAnswerReviewInputData, FinalAnswerReviewOutputData>
{
  constructor(
    private readonly socketGameValidationService: SocketGameValidationService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter
  ) {}

  public async execute(
    ctx: ActionExecutionContext<FinalAnswerReviewInputData>
  ): Promise<ActionHandlerResult<FinalAnswerReviewOutputData>> {
    const { game, currentPlayer, action } = ctx;

    GameStateValidator.validateGameInProgress(game);
    this.socketGameValidationService.validateQuestionAction(
      currentPlayer,
      game,
      QuestionAction.ANSWER_RESULT
    );
    FinalAnswerReviewLogic.validate(game);

    const mutationResult = FinalAnswerReviewLogic.reviewAnswer(
      game,
      action.payload
    );

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: {
        playerId: currentPlayer?.meta.id,
        isSystem: false,
      },
    });

    const result = FinalAnswerReviewLogic.buildResult({
      game,
      mutationResult,
      transitionResult,
    });

    const outputData: FinalAnswerReviewOutputData = {
      answerId: action.payload.answerId,
      playerId: result.reviewResult.playerId,
      isCorrect: action.payload.isCorrect,
      scoreChange: result.reviewResult.scoreChange,
    };

    const mutations: DataMutation[] = [
      DataMutationConverter.saveGameMutation(game),
      ...DataMutationConverter.mutationFromTimerMutations(
        transitionResult?.timerMutations
      ),
      DataMutationConverter.gameBroadcastMutation(
        game.id,
        SocketIOGameEvents.FINAL_ANSWER_REVIEW,
        outputData
      ),
    ];

    if (result.isGameFinished) {
      mutations.push(
        DataMutationConverter.gameBroadcastMutation(
          game.id,
          SocketIOGameEvents.QUESTION_FINISH,
          {
            answerFiles: null,
            answerText: result.questionAnswerData?.answerText ?? null,
            nextTurnPlayerId: null,
          } satisfies QuestionFinishEventPayload
        )
      );

      mutations.push(
        DataMutationConverter.gameBroadcastMutation(
          game.id,
          SocketIOGameEvents.GAME_FINISHED,
          true
        )
      );

      mutations.push(DataMutationConverter.gameCompletionMutation(game.id));
    }

    return {
      success: true,
      data: outputData,
      mutations,
      broadcastGame: game,
    };
  }
}

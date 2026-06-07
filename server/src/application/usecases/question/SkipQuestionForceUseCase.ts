import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { timerKey } from "domain/constants/redisKeys";
import { type Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { SocketBroadcastTarget } from "domain/enums/SocketBroadcastTarget";
import { QuestionForceSkipLogic } from "domain/logic/question/QuestionForceSkipLogic";
import { ShowAnswerLogic } from "domain/logic/question/ShowAnswerLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import {
  type ActionExecutionContext,
  type TimerMutation
} from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { type PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { type SocketEventBroadcast } from "domain/types/socket/SocketEventBroadcast";
import { type AnswerShowStartEventPayload } from "domain/types/socket/events/game/AnswerShowEventPayload";
import { type QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { EmptyInputData, EmptyOutputData } from "domain/types/socket/events/SocketEventInterfaces";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

/**
 * Handles force skipping a question (showman action).
 */
export class SkipQuestionForceUseCase implements GameActionHandler<
  EmptyInputData,
  EmptyOutputData
> {
  constructor(
    private readonly packageStore: PackageStore,
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly transitionResourceService: TransitionResourceService
  ) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<EmptyOutputData>> {
    const { game, currentPlayer } = ctx;

    QuestionActionValidator.validateForceSkipAction({
      game,
      currentPlayer,
      action: QuestionAction.FORCE_SKIP
    });

    const transitionResult = await this.tryRegularQuestionTransition(ctx);
    if (transitionResult) {
      return transitionResult;
    }

    const forceSkipQuestionId =
      game.gameState.currentQuestion?.id ??
      game.gameState.stakeQuestionData?.questionId ??
      game.gameState.secretQuestionData?.questionId ??
      null;

    const forceSkipQuestionData = forceSkipQuestionId
      ? await this.packageStore.getQuestionWithTheme(game.id, forceSkipQuestionId)
      : null;

    const { question, themeId } = QuestionForceSkipLogic.getQuestionToSkip(forceSkipQuestionData);

    QuestionForceSkipLogic.processForceSkip(game, question, themeId);

    game.setQuestionState(QuestionState.SHOWING_ANSWER);
    game.gameState.currentQuestion = null;
    game.gameState.stakeQuestionData = null;
    game.gameState.secretQuestionData = null;
    game.gameState.answeredPlayers = null;
    game.gameState.skippedPlayers = null;
    game.gameState.answeringPlayer = null;

    const timerMutations = this.buildShowAnswerTimerMutations(game, question);

    const questionFinishPayload: QuestionFinishEventPayload = {
      answerFiles: question?.answerFiles ?? null,
      answerText: question?.answerText ?? null,
      nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null
    };
    game.gameState.answerShowData = questionFinishPayload;

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.QUESTION_FINISH,
        data: questionFinishPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id
      } satisfies SocketEventBroadcast<QuestionFinishEventPayload>,
      {
        event: SocketIOGameEvents.ANSWER_SHOW_START,
        data: {},
        target: SocketBroadcastTarget.GAME,
        gameId: game.id
      } satisfies SocketEventBroadcast<AnswerShowStartEventPayload>
    ];

    return {
      success: true,
      data: {},
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromTimerMutations(timerMutations),
        ...DataMutationConverter.mutationFromSocketBroadcasts(broadcasts)
      ],
      broadcastGame: game
    };
  }

  private async tryRegularQuestionTransition(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<EmptyOutputData> | null> {
    const { game, currentPlayer } = ctx;

    if (
      game.gameState.questionState !== QuestionState.SHOWING ||
      !game.gameState.currentQuestion
    ) {
      return null;
    }

    const transitionResources =
      await this.transitionResourceService.getCurrentQuestionWithTheme(game);

    QuestionForceSkipLogic.getQuestionToSkip(
      transitionResources?.questionWithTheme ?? null
    );

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: {
        playerId: currentPlayer!.meta.id,
        isSystem: false
      },
      ...(transitionResources ? { resources: transitionResources } : {})
    });

    if (!transitionResult) {
      return null;
    }

    return {
      success: true,
      data: {},
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromTimerMutations(
          transitionResult.timerMutations
        ),
        ...DataMutationConverter.mutationFromServiceBroadcasts(
          transitionResult.broadcasts,
          game.id
        )
      ],
      broadcastGame: game
    };
  }

  private buildShowAnswerTimerMutations(
    game: Game,
    question: PackageQuestionDTO
  ): TimerMutation[] {
    const duration = ShowAnswerLogic.calculateShowAnswerDuration(question);
    const timer = new GameStateTimer(duration);
    const timerValue = timer.start();
    game.gameState.timer = timerValue;

    return [
      { op: "delete", key: timerKey(game.id) },
      {
        op: "set",
        key: timerKey(game.id),
        value: JSON.stringify(timerValue),
        pxTtl: duration
      }
    ];
  }
}

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { QuestionForceSkipLogic } from "domain/logic/question/QuestionForceSkipLogic";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { type AnswerShowStartEventPayload } from "domain/types/socket/events/game/AnswerShowEventPayload";
import { type QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import {
  EmptyInputData,
  EmptyOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

/**
 * Stateless action handler for force skipping a question (showman).
 */
export class SkipQuestionForceActionHandler
  implements GameActionHandler<EmptyInputData, EmptyOutputData>
{
  constructor(private readonly packageStore: PackageStore) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<EmptyOutputData>> {
    const { game, currentPlayer } = ctx;

    QuestionActionValidator.validateForceSkipAction({
      game,
      currentPlayer,
      action: QuestionAction.FORCE_SKIP,
    });

    const forceSkipQuestionId =
      game.gameState.currentQuestion?.id ??
      game.gameState.stakeQuestionData?.questionId ??
      game.gameState.secretQuestionData?.questionId ??
      null;

    const forceSkipQuestionData = forceSkipQuestionId
      ? await this.packageStore.getQuestionWithTheme(
          game.id,
          forceSkipQuestionId
        )
      : null;

    const { question, themeId } = QuestionForceSkipLogic.getQuestionToSkip(
      game,
      forceSkipQuestionData
    );

    QuestionForceSkipLogic.processForceSkip(game, question, themeId);

    game.setQuestionState(QuestionState.SHOWING_ANSWER);
    game.gameState.currentQuestion = null;
    game.gameState.answeredPlayers = null;
    game.gameState.skippedPlayers = null;
    game.gameState.answeringPlayer = null;

    const questionFinishPayload: QuestionFinishEventPayload = {
      answerFiles: question?.answerFiles ?? null,
      answerText: question?.answerText ?? null,
      nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
    };

    const broadcasts: SocketEventBroadcast[] = [
      {
        event: SocketIOGameEvents.QUESTION_FINISH,
        data: questionFinishPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<QuestionFinishEventPayload>,
      {
        event: SocketIOGameEvents.ANSWER_SHOW_START,
        data: {},
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<AnswerShowStartEventPayload>,
    ];

    return {
      success: true,
      data: {},
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromSocketBroadcasts(broadcasts),
      ],
    };
  }
}

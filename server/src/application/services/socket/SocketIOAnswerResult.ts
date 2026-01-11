import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "application/di/tokens";
import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { PlayerGameStatsService } from "application/services/statistics/PlayerGameStatsService";
import { TransitionTrigger } from "domain/state-machine/types";
import { ActionContext } from "domain/types/action/ActionContext";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { QuestionAnswerResultLogic } from "domain/logic/question/QuestionAnswerResultLogic";
import { AnswerResultData } from "domain/types/socket/game/AnswerResultData";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogPrefix } from "infrastructure/logger/LogPrefix";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import {
  AnsweringToShowingAnswerMutationData,
  AnswerResultTransitionPayload,
} from "domain/types/socket/transition/answering";
import { GameStateAnsweredPlayerData } from "domain/types/dto/game/state/GameStateDTO";
import { PackageQuestionType } from "domain/enums/package/QuestionType";

/**
 * Service handling showman reviewing player's answer (correct/wrong).
 *
 * Extracted from SocketIOQuestionService to keep question service smaller.
 */
@singleton()
export class SocketIOAnswerResultService {
  constructor(
    private readonly gameService: GameService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly playerGameStatsService: PlayerGameStatsService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  public async handleAnswerResult(ctx: ActionContext, data: AnswerResultData) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    QuestionActionValidator.validateAnswerResultAction({
      game,
      currentPlayer,
      action: QuestionAction.ANSWER_RESULT,
    });

    // Can transition to showing or showing answer states
    const transitionResult =
      await this.phaseTransitionRouter.tryTransition<AnswerResultTransitionPayload>(
        {
          game,
          trigger: TransitionTrigger.USER_ACTION,
          triggeredBy: { playerId: currentPlayer!.meta.id, isSystem: false },
          payload: {
            answerType: data.answerType,
            scoreResult: data.scoreResult,
            questionType:
              game.gameState.currentQuestion?.type ??
              PackageQuestionType.SIMPLE,
          },
        }
      );

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    const resultData = transitionResult.data as
      | AnsweringToShowingAnswerMutationData
      | undefined;

    const playerAnswerResult = resultData?.playerAnswerResult ?? null;

    if (playerAnswerResult) {
      await this._updatePlayerAnswerStats(game, playerAnswerResult, data);
    }

    await this.gameService.updateGame(game);

    const timerDto = transitionResult.timer;

    const responseData = QuestionAnswerResultLogic.buildSocketPayload({
      answerResult: playerAnswerResult!,
      timer: timerDto ?? null,
    });

    return {
      game,
      data: responseData,
      broadcasts: transitionResult.broadcasts,
    };
  }

  /**
   * Update player answer statistics (non-blocking).
   */
  private async _updatePlayerAnswerStats(
    game: Game,
    playerAnswerResult: GameStateAnsweredPlayerData,
    data: AnswerResultData
  ): Promise<void> {
    try {
      await this.playerGameStatsService.updatePlayerAnswerStats(
        game.id,
        playerAnswerResult.player,
        data.answerType,
        playerAnswerResult.score
      );
    } catch (error) {
      // Log but don't throw - statistics shouldn't break game flow
      this.logger.warn("Failed to update player answer statistics", {
        prefix: LogPrefix.SOCKET_QUESTION,
        gameId: game.id,
        playerId: playerAnswerResult.player,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

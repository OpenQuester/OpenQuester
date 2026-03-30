import { singleton } from "tsyringe";

import { Game } from "domain/entities/game/Game";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import {
  AnsweringPlayerLeaveLogic,
  AnsweringScenarioType,
} from "domain/logic/player-leave/AnsweringPlayerLeaveLogic";
import {
  IPlayerLeaveStrategy,
  PlayerLeaveStrategyResult,
} from "domain/logic/player-leave/strategies/IPlayerLeaveStrategy";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { type TransitionResult, TransitionTrigger } from "domain/state-machine/types";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { AnswerResultTransitionPayload } from "domain/types/socket/transition/answering";

@singleton()
export class AnsweringLeaveStrategy implements IPlayerLeaveStrategy {
  constructor(private readonly phaseTransitionRouter: PhaseTransitionRouter) {}

  public canHandle(game: Game, userId: number): boolean {
    return AnsweringPlayerLeaveLogic.validate(game, userId).isEligible;
  }

  public async execute(
    game: Game,
    userId: number
  ): Promise<PlayerLeaveStrategyResult> {
    const validation = AnsweringPlayerLeaveLogic.validate(game, userId);

    if (validation.scenarioType === AnsweringScenarioType.FINAL_ROUND) {
      return this._handleFinalRoundAnsweringLeave(game, userId);
    }

    return this._handleRegularRoundAnsweringLeave(game, userId);
  }

  private async _handleFinalRoundAnsweringLeave(
    game: Game,
    userId: number
  ): Promise<PlayerLeaveStrategyResult> {
    const wasProcessed = AnsweringPlayerLeaveLogic.processFinalRoundAutoLoss(
      game,
      userId
    );

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.PLAYER_LEFT,
      triggeredBy: { playerId: userId, isSystem: false },
    });

    const logicResult = AnsweringPlayerLeaveLogic.buildFinalRoundResult({
      game,
      userId,
      wasProcessed,
      transitionResult,
    });

    const result: PlayerLeaveStrategyResult = {
      mutations: [],
      broadcasts: logicResult.broadcasts,
    };

    if (transitionResult) {
      result.mutations.push(
        ...DataMutationConverter.mutationFromTimerMutations(
          transitionResult.timerMutations
        )
      );
    }

    return result;
  }

  private async _handleRegularRoundAnsweringLeave(
    game: Game,
    userId: number
  ): Promise<PlayerLeaveStrategyResult> {
    const currentQuestion = game.gameState.currentQuestion;
    const questionType = currentQuestion?.type ?? PackageQuestionType.SIMPLE;

    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.PLAYER_LEFT,
      triggeredBy: { playerId: userId, isSystem: false },
      payload: {
        answerType: AnswerResultType.SKIP,
        scoreResult: 0,
        questionType,
      } satisfies AnswerResultTransitionPayload,
    });

    const result: PlayerLeaveStrategyResult = {
      mutations: [],
      broadcasts: [],
    };

    if (transitionResult) {
      result.broadcasts.push(...transitionResult.broadcasts);
      result.mutations.push(
        ...DataMutationConverter.mutationFromTimerMutations(
          transitionResult.timerMutations
        )
      );
    }

    return result;
  }
}

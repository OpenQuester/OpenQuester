import { singleton } from "tsyringe";

import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import {
  PlayerLeaveCleanupOptions,
  PlayerLeaveOptions,
  PlayerLeaveOrchestrator
} from "domain/logic/player-leave/PlayerLeaveOrchestrator";
import {
  AnsweringPlayerLeaveLogic,
  AnsweringScenarioType
} from "domain/logic/player-leave/AnsweringPlayerLeaveLogic";
import { FinalBiddingPlayerLeaveLogic } from "domain/logic/player-leave/FinalBiddingPlayerLeaveLogic";
import { StakeBiddingPlayerLeaveLogic } from "domain/logic/player-leave/StakeBiddingPlayerLeaveLogic";
import { PlayerLeaveStrategyResult } from "domain/logic/player-leave/strategies/IPlayerLeaveStrategy";
import { DEFAULT_QUESTION_PRICE } from "domain/constants/timer";
import { Game } from "domain/entities/game/Game";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { type TransitionResources } from "domain/state-machine/types";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

export interface PlayerLeaveRequestOptions {
  reason: PlayerLeaveOptions["reason"];
}

/**
 * Application service for player leave flows.
 *
 * Loads server-only data needed by domain leave strategies without storing it
 * in public game state.
 */
@singleton()
export class PlayerLeaveService {
  public constructor(
    private readonly playerLeaveOrchestrator: PlayerLeaveOrchestrator,
    private readonly transitionResourceService: TransitionResourceService,
    private readonly packageStore: PackageStore
  ) {
    //
  }

  public async processLeave(
    game: Game,
    userId: number,
    options: PlayerLeaveRequestOptions
  ): Promise<PlayerLeaveStrategyResult> {
    const stakeBidding = await this._resolveStakeBiddingInput(game, userId);
    const transitionResources = await this._resolveTransitionResources(game, userId);

    return this.playerLeaveOrchestrator.processLeave(game, userId, {
      ...options,
      stakeBidding,
      transitionResources
    });
  }

  public async processGameStateCleanup(
    game: Game,
    userId: number
  ): Promise<PlayerLeaveStrategyResult> {
    const stakeBidding = await this._resolveStakeBiddingInput(game, userId);
    const transitionResources = await this._resolveTransitionResources(game, userId);
    const options: PlayerLeaveCleanupOptions = {
      stakeBidding,
      transitionResources
    };

    return this.playerLeaveOrchestrator.processGameStateCleanup(game, userId, options);
  }

  private async _resolveStakeBiddingInput(
    game: Game,
    userId: number
  ): Promise<PlayerLeaveOptions["stakeBidding"]> {
    const validation = StakeBiddingPlayerLeaveLogic.validate(game, userId);
    if (!validation.isEligible) {
      return undefined;
    }

    const stakeData = game.gameState.stakeQuestionData;
    if (!stakeData) {
      return undefined;
    }

    const question = await this.packageStore.getQuestion(game.id, stakeData.questionId);

    return {
      minimumBid: question?.price || DEFAULT_QUESTION_PRICE
    };
  }

  private async _resolveTransitionResources(
    game: Game,
    userId: number
  ): Promise<TransitionResources | undefined> {
    const validation = AnsweringPlayerLeaveLogic.validate(game, userId);
    const questionType = game.gameState.currentQuestion?.type ?? PackageQuestionType.SIMPLE;

    const stakeData = game.gameState.stakeQuestionData;
    if (stakeData?.biddingPhase) {
      const question = await this.packageStore.getQuestion(game.id, stakeData.questionId);

      return this.transitionResourceService.fromSimpleQuestion(question);
    }

    const finalBidding = FinalBiddingPlayerLeaveLogic.validate(game, userId);
    if (finalBidding.isEligible) {
      return this.transitionResourceService.getFinalRoundQuestionData(game);
    }

    if (validation.scenarioType !== AnsweringScenarioType.REGULAR_ROUND) {
      return undefined;
    }

    if (questionType === PackageQuestionType.SIMPLE && !game.willAllPlayersBeExhausted()) {
      return this.transitionResourceService.getSavedShowingTimer(game);
    }

    return this.transitionResourceService.getCurrentQuestionWithTheme(game);
  }
}

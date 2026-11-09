import { singleton } from "tsyringe";

import { GameService } from "application/services/game/GameService";
import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { RoundHandlerFactory } from "domain/factories/RoundHandlerFactory";
import { FinalRoundHandler } from "domain/handlers/round/FinalRoundHandler";
import { ThemeEliminateLogic } from "domain/logic/final-round/ThemeEliminateLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { AutoLossProcessLogic } from "domain/state-machine/logic/AutoLossProcessLogic";
import { BiddingTimeoutLogic } from "domain/state-machine/logic/BiddingTimeoutLogic";
import { TransitionTrigger } from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import {
  AutoLossProcessResult,
  BiddingTimeoutResult,
  ThemeEliminationTimeoutResult
} from "domain/types/socket/finalround/FinalRoundResults";
import { FinalRoundStateManager } from "domain/utils/FinalRoundStateManager";

/**
 * Service for handling final round specific operations.
 * Handles theme elimination, bidding, answering, and reviewing phases.
 */
@singleton()
export class FinalRoundService {
  constructor(
    private readonly gameService: GameService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly transitionResourceService: TransitionResourceService
  ) {
    //
  }

  /**
   * Eliminate a random theme on timeout if a choice remains.
   *
   * Uses ThemeEliminateLogic for random selection and elimination,
   * then attempts phase transition via PhaseTransitionRouter.
   */
  public async handleThemeEliminationTimeout(
    gameId: string
  ): Promise<ThemeEliminationTimeoutResult> {
    const game = await this.gameService.getGameEntity(gameId);
    if (!game || game.gameState.questionState !== QuestionState.THEME_ELIMINATION) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    const finalRoundHandler = this._getFinalRoundHandler(game);

    const themeId = finalRoundHandler.isThemeEliminationComplete(game)
      ? null
      : ThemeEliminateLogic.selectRandomTheme(game, finalRoundHandler);
    const mutationResult =
      themeId == null ? null : ThemeEliminateLogic.eliminateTheme(game, themeId, finalRoundHandler);

    // FINAL_THEME_ELIMINATION -> FINAL_BIDDING when one theme remains.
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.TIMER_EXPIRED,
      triggeredBy: { isSystem: true },
      resources: await this.transitionResourceService.getFinalRoundQuestionData(game)
    });

    // Persist game state
    await this.gameService.updateGame(game);

    return ThemeEliminateLogic.buildTimeoutResult({
      game,
      mutationResult,
      transitionResult
    });
  }

  /**
   * Handle bidding timeout - auto-submit minimum bids for players who haven't bid.
   *
   * Uses BiddingTimeoutLogic for auto-bid processing,
   * then attempts phase transition via PhaseTransitionRouter.
   */
  public async handleFinalBiddingTimeout(game: Game): Promise<BiddingTimeoutResult> {
    if (game.gameState.questionState !== QuestionState.BIDDING) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);

    if (!finalRoundData) {
      throw new ClientError(ClientResponse.GAME_NOT_STARTED);
    }

    // Process timeout bids via Logic class
    const mutationResult = BiddingTimeoutLogic.processTimeout(game);

    // FINAL_BIDDING -> MEDIA_DOWNLOADING with question files, otherwise -> FINAL_ANSWERING.
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.TIMER_EXPIRED,
      triggeredBy: { isSystem: true },
      resources: await this.transitionResourceService.getFinalRoundQuestionData(game)
    });

    // Transition must succeed for bidding timeout (all bids now submitted)
    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    // Persist game state
    await this.gameService.updateGame(game);

    return BiddingTimeoutLogic.buildResult({
      game,
      mutationResult,
      transitionResult
    });
  }

  /**
   * Process auto-loss answers when answering time expires.
   *
   * Uses AutoLossProcessLogic for pure mutation logic.
   */
  public async processAutoLossAnswers(game: Game): Promise<AutoLossProcessResult> {
    if (game.gameState.questionState !== QuestionState.ANSWERING) {
      throw new ClientError(ClientResponse.GAME_DATA_IS_CORRUPTED);
    }

    const finalRoundData = FinalRoundStateManager.getFinalRoundData(game);
    if (!finalRoundData) {
      throw new ClientError(ClientResponse.FINAL_ROUND_NOT_INITIALIZED);
    }

    // Use Logic class for pure mutation
    const mutationResult = AutoLossProcessLogic.processAutoLoss(game, finalRoundData);

    // FINAL_ANSWERING -> FINAL_REVIEWING once every answer has been submitted.
    const transitionResult = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.TIMER_EXPIRED,
      triggeredBy: { isSystem: true }
    });

    if (transitionResult && FinalRoundStateManager.areAllAnswersReviewed(game)) {
      // All auto-losses: FINAL_REVIEWING -> SHOWING_ANSWER with answer media,
      // otherwise FINAL_REVIEWING -> GAME_FINISHED.
      const reviewCompletionTransition = await this.phaseTransitionRouter.tryTransition({
        game,
        trigger: TransitionTrigger.CONDITION_MET,
        triggeredBy: { isSystem: true },
        resources: await this.transitionResourceService.getFinalReviewCompletionResources(game)
      });

      // Merge broadcasts from both transitions
      if (reviewCompletionTransition) {
        transitionResult.broadcasts.push(...reviewCompletionTransition.broadcasts);
        transitionResult.timerMutations.push(...reviewCompletionTransition.timerMutations);
      }
    }

    await this.gameService.updateGame(game);

    return AutoLossProcessLogic.buildResult({
      game,
      mutationResult,
      transitionResult
    });
  }

  // Private helper methods

  private _getFinalRoundHandler(_game: Game): FinalRoundHandler {
    return RoundHandlerFactory.create(PackageRoundType.FINAL) as FinalRoundHandler;
  }
}

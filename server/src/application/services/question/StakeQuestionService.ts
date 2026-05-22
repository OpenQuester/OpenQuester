import { singleton } from "tsyringe";

import { GameService } from "application/services/game/GameService";
import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { STAKE_QUESTION_BID_TIME } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { StakeBidSubmitLogic } from "domain/logic/special-question/StakeBidSubmitLogic";
import { StakeBiddingTimeoutLogic } from "domain/logic/timer/StakeBiddingTimeoutLogic";
import { StakeBiddingMapper } from "domain/mappers/StakeBiddingMapper";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type TimerMutation } from "domain/types/action/ActionExecutionContext";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import {
  StakeBidSubmitInputData,
  StakeBidType
} from "domain/types/socket/events/game/StakeQuestionEventData";
import {
  StakeBidSubmitResult,
  StakeBiddingTimeoutMutationResult,
  StakeBiddingTimeoutResult
} from "domain/types/socket/question/StakeQuestionResults";
import { StakeBiddingToAnsweringPayload } from "domain/types/socket/transition/special-question";
import { StakeQuestionValidator } from "domain/validators/StakeQuestionValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

export interface StakeBidSubmitContextResult extends StakeBidSubmitResult {
  timerMutations: TimerMutation[];
}

/**
 * Service handling stake question type.
 */
@singleton()
export class StakeQuestionService {
  constructor(
    private readonly gameService: GameService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly socketQuestionStateService: SocketQuestionStateService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly transitionResourceService: TransitionResourceService,
    private readonly packageStore: PackageStore
  ) {
    //
  }

  /**
   * Handles stake question bid submission.
   */
  public async handleStakeBidSubmit(
    game: Game,
    currentPlayer: Player,
    inputData: StakeBidSubmitInputData
  ): Promise<StakeBidSubmitContextResult> {
    const bid: number | StakeBidType =
      inputData.bidType === StakeBidType.NORMAL && inputData.bidAmount !== null
        ? inputData.bidAmount
        : inputData.bidType;

    StakeQuestionValidator.validateBidSubmission({
      game,
      currentPlayer,
      stakeData: game.gameState.stakeQuestionData ?? null
    });

    const stakeData = game.gameState.stakeQuestionData!;

    const biddingPlayer = StakeBidSubmitLogic.resolveBiddingPlayer(game, currentPlayer, stakeData);

    const stakeQuestionData = await this.packageStore.getQuestionWithTheme(
      game.id,
      stakeData.questionId
    );

    if (!stakeQuestionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const allPlayers = game.getInGamePlayers().map((player) => player.toDTO());

    const bidResult = StakeBiddingMapper.placeBid({
      playerId: biddingPlayer.meta.id,
      bid,
      stakeData,
      currentPlayer: biddingPlayer.toDTO(),
      questionPrice: stakeQuestionData.question.price || 1,
      allPlayers
    });

    game.gameState.stakeQuestionData = bidResult.updatedStakeData;

    const bidType = bidResult.bidType;
    const bidAmount = bidResult.bidAmount;
    const isPhaseComplete = bidResult.isPhaseComplete ?? false;
    const nextBidderId = bidResult.nextBidderId ?? null;
    const updatedStakeData = bidResult.updatedStakeData;
    const timerMutations: TimerMutation[] = [];
    let timer: GameStateTimerDTO | undefined;
    let questionData: PackageQuestionDTO | undefined;

    if (isPhaseComplete && updatedStakeData.winnerPlayerId) {
      const completionResult = await this._completeStakeBiddingPhaseFromContext({
        game,
        biddingPlayerId: biddingPlayer.meta.id,
        winnerPlayerId: updatedStakeData.winnerPlayerId,
        questionId: updatedStakeData.questionId,
        finalBid: updatedStakeData.highestBid
      });

      timer = completionResult.timer;
      questionData = completionResult.questionData;
      timerMutations.push(...completionResult.timerMutations);
    } else if (nextBidderId !== null) {
      const timerResult = this._buildStakeBiddingTimerMutations(game);
      timer = timerResult.timer;
      timerMutations.push(...timerResult.timerMutations);
    }

    return {
      ...StakeBidSubmitLogic.buildResult({
        game,
        playerId: biddingPlayer.meta.id,
        bidAmount,
        bidType,
        isPhaseComplete,
        nextBidderId,
        winnerPlayerId: updatedStakeData.winnerPlayerId,
        questionData: questionData ?? null,
        timer
      }),
      timerMutations
    };
  }

  /**
   * Handles stake bidding timer expiration (regular rounds).
   */
  public async handleStakeBiddingTimeout(gameId: string): Promise<StakeBiddingTimeoutResult> {
    const game = await this.gameService.getGameEntity(gameId);

    if (!game) {
      throw new ClientError(ClientResponse.GAME_NOT_FOUND);
    }

    if (!TransitionGuards.isStakeBiddingPhase(game)) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    const stakeData = game.gameState.stakeQuestionData!;
    const stakeQuestionData = await this.packageStore.getQuestionWithTheme(
      game.id,
      stakeData.questionId
    );
    const stakeQuestion = stakeQuestionData?.question ?? null;
    const questionPrice = stakeQuestion?.price ?? 0;

    const mutationResult: StakeBiddingTimeoutMutationResult =
      StakeBiddingTimeoutLogic.processTimeout(game, questionPrice);

    let transitionResult = null;
    let timer: GameStateTimerDTO | undefined;

    if (mutationResult.isPhaseComplete && mutationResult.winnerPlayerId !== null) {
      transitionResult =
        await this.phaseTransitionRouter.tryTransition<StakeBiddingToAnsweringPayload>({
          game,
          trigger: TransitionTrigger.TIMER_EXPIRED,
          triggeredBy: { isSystem: true },
          payload: {
            isPhaseComplete: true,
            winnerPlayerId: mutationResult.winnerPlayerId,
            finalBid: mutationResult.highestBid
          },
          resources: this.transitionResourceService.fromQuestionWithTheme(stakeQuestionData)
        });
    } else if (!mutationResult.isPhaseComplete) {
      // Update state just in case
      game.setQuestionState(QuestionState.BIDDING);
      timer = await this._setupStakeBiddingTimer(game);
    }

    await this.gameService.updateGame(game);

    return StakeBiddingTimeoutLogic.buildResult({
      game,
      mutationResult,
      transitionResult,
      timer
    });
  }

  private async _setupStakeBiddingTimer(game: Game): Promise<GameStateTimerDTO> {
    await this.gameService.clearTimer(game.id);

    const timerEntity = await this.socketQuestionStateService.setupQuestionTimer(
      game,
      STAKE_QUESTION_BID_TIME
    );

    return timerEntity.start();
  }

  private async _completeStakeBiddingPhaseFromContext(input: {
    game: Game;
    biddingPlayerId: number;
    winnerPlayerId: number;
    questionId: number;
    finalBid: number | null;
  }): Promise<{
    timer: GameStateTimerDTO | undefined;
    questionData: PackageQuestionDTO;
    timerMutations: TimerMutation[];
  }> {
    const questionAndTheme = await this.packageStore.getQuestionWithTheme(
      input.game.id,
      input.questionId
    );

    if (!questionAndTheme) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    const transitionResult =
      await this.phaseTransitionRouter.tryTransition<StakeBiddingToAnsweringPayload>({
        game: input.game,
        trigger: TransitionTrigger.USER_ACTION,
        triggeredBy: { playerId: input.biddingPlayerId, isSystem: false },
        payload: {
          isPhaseComplete: true,
          winnerPlayerId: input.winnerPlayerId,
          finalBid: input.finalBid
        },
        resources: this.transitionResourceService.fromQuestionWithTheme(questionAndTheme)
      });

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    return {
      timer: transitionResult.timer ?? undefined,
      questionData: questionAndTheme.question,
      timerMutations: transitionResult.timerMutations
    };
  }

  private _buildStakeBiddingTimerMutations(game: Game): {
    timer: GameStateTimerDTO;
    timerMutations: TimerMutation[];
  } {
    const timer = new GameStateTimer(STAKE_QUESTION_BID_TIME).start();
    game.gameState.timer = timer;

    return {
      timer,
      timerMutations: [
        { op: "delete", key: timerKey(game.id) },
        {
          op: "set",
          key: timerKey(game.id),
          value: JSON.stringify(timer),
          pxTtl: STAKE_QUESTION_BID_TIME
        }
      ]
    };
  }
}

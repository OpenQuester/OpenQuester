import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { type Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { QuestionPickLogic } from "domain/logic/question/QuestionPickLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import {
  GamePhase,
  type TransitionResult,
  TransitionTrigger,
} from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";
import { SecretQuestionPickedBroadcastData } from "domain/types/socket/events/game/SecretQuestionPickedEventPayload";
import { StakeBidSubmitOutputData } from "domain/types/socket/events/game/StakeQuestionEventData";
import { StakeQuestionPickedBroadcastData } from "domain/types/socket/events/game/StakeQuestionPickedEventPayload";
import { QuestionPickInputData } from "domain/types/socket/events/SocketEventInterfaces";
import {
  type ChoosingToSecretTransferMutationData,
  type ChoosingToStakeBiddingMutationData,
  type QuestionPickPayload,
} from "domain/types/socket/transition/choosing";
import { type StakeBiddingToAnsweringPayload } from "domain/types/socket/transition/special-question";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

export enum QuestionPickType {
  NORMAL = "normal",
  SECRET = "secret",
  STAKE = "stake",
}
/**
 * Result of question pick action.
 * Contains all data needed for socket handler's afterBroadcast to perform
 * personalized emissions (different data for showman vs players).
 */
export interface QuestionPickResult {
  type: QuestionPickType;
  gameId: string;
  /** Timer data for question display */
  timer?: GameStateTimerDTO;
  /** Full question data (for normal questions - socket handler will filter per role) */
  question?: PackageQuestionDTO;
  /** Data for secret question broadcast */
  secretData?: SecretQuestionPickedBroadcastData;
  /** Data for stake question broadcast */
  stakeData?: StakeQuestionPickedBroadcastData;
  /** Automatic bid data when only one player eligible for stake question */
  automaticNominalBid?: PlayerBidData | null;
}

/**
 * Stateless action handler for question picking.
 *
 * Context-aware: receives prefetched game/player/timer from the executor's
 * IN pipeline. Still requires PackageStore read (1 RT, unavoidable) and
 * PhaseTransitionRouter calls for timer management (1-2 RT, unavoidable).
 *
 * **Architecture Note**: This handler does business logic and state mutation.
 * For NORMAL questions, it returns empty broadcasts because the socket handler's
 * `afterBroadcast` must perform personalized per-socket emissions (showman sees
 * full answer, players see filtered data).
 *
 * SECRET and STAKE questions emit events that are identical for all players.
 */
export class QuestionPickActionHandler
  implements GameActionHandler<QuestionPickInputData, QuestionPickResult>
{
  constructor(
    private readonly packageStore: PackageStore,
    private readonly phaseTransitionRouter: PhaseTransitionRouter
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<QuestionPickInputData>
  ): Promise<ActionHandlerResult<QuestionPickResult>> {
    const { game, currentPlayer } = ctx;
    const { questionId } = ctx.action.payload;

    QuestionActionValidator.validatePickAction({
      game,
      currentPlayer,
      action: QuestionAction.PICK,
    });

    // Fetch question data from PackageStore
    const questionData = QuestionPickLogic.validateQuestionPick(
      game,
      await this.packageStore.getQuestionWithTheme(game.id, questionId)
    );

    // Capture eligible players BEFORE any transitions
    // This prevents players who join mid-question from answering
    game.captureQuestionEligiblePlayers();

    // Route transition based on question type/state (1-2 RT for timer ops)
    let transitionResult =
      await this.phaseTransitionRouter.tryTransition<QuestionPickPayload>({
        game,
        trigger: TransitionTrigger.USER_ACTION,
        triggeredBy: { playerId: currentPlayer!.meta.id, isSystem: false },
        payload: { questionId, questionData },
      });

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    // Auto-advance if stake bidding is immediately resolved
    if (
      transitionResult.toPhase === GamePhase.STAKE_BIDDING &&
      game.gameState.stakeQuestionData
    ) {
      transitionResult = await this._autoAdvanceStakeBiddingIfResolved(
        game,
        currentPlayer!,
        transitionResult
      );
    }

    const timerDto = transitionResult.timer;
    const timer = timerDto ? GameStateTimer.fromDTO(timerDto) : null;

    // Build type-specific result (pure logic, same as legacy path)
    const result = QuestionPickLogic.buildResult(
      game,
      questionData.question,
      timer,
      transitionResult
    );

    return {
      ...result,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromTimerMutations(
          transitionResult.timerMutations
        ),
        ...DataMutationConverter.mutationFromServiceBroadcasts(
          transitionResult.broadcasts,
          game.id
        ),
      ],
      broadcastGame: game,
    };
  }

  /**
   * Automatically trigger phase transition if stake bidding is ended.
   *
   * For example: no eligible bidders and picker gets auto-bid therefore auto-winning.
   */
  private async _autoAdvanceStakeBiddingIfResolved(
    game: Game,
    currentPlayer: Player,
    transitionResult: TransitionResult
  ): Promise<TransitionResult> {
    const stakeData = game.gameState.stakeQuestionData;

    if (!stakeData) {
      return transitionResult;
    }

    const currentHighestBid = stakeData.highestBid ?? 0;
    const winnerId = stakeData.winnerPlayerId;

    if (!winnerId) {
      return transitionResult;
    }

    // Check if any other eligible player can outbid
    const canAnyoneOutbid = game.players.some((p) => {
      if (
        p.meta.id === winnerId ||
        p.role !== PlayerRole.PLAYER ||
        p.gameStatus !== PlayerGameStatus.IN_GAME
      ) {
        return false;
      }
      return p.score > currentHighestBid;
    });

    if (canAnyoneOutbid) {
      return transitionResult;
    }

    // Transition to ANSWERING immediately (1-2 RT for timer ops)
    const autoFinishTransition =
      await this.phaseTransitionRouter.tryTransition<StakeBiddingToAnsweringPayload>(
        {
          game,
          trigger: TransitionTrigger.CONDITION_MET,
          triggeredBy: {
            playerId: currentPlayer.meta.id,
            isSystem: true,
          },
          payload: {
            isPhaseComplete: true,
            winnerPlayerId: winnerId,
            finalBid: currentHighestBid,
          },
        }
      );

    if (!autoFinishTransition) {
      return transitionResult;
    }

    // Find and update STAKE_BID_SUBMIT event from previous transition
    const bidEvent = transitionResult.broadcasts.find(
      (e) => e.event === SocketIOGameEvents.STAKE_BID_SUBMIT
    );

    if (bidEvent) {
      const data = bidEvent.data as StakeBidSubmitOutputData;
      data.isPhaseComplete = true;
      data.nextBidderId = null;
      data.timer = undefined;
    }

    return {
      ...autoFinishTransition,
      success: true,
      broadcasts: [
        ...transitionResult.broadcasts,
        ...autoFinishTransition.broadcasts,
      ],
      timerMutations: [
        ...(transitionResult.timerMutations ?? []),
        ...(autoFinishTransition.timerMutations ?? []),
      ],
    } satisfies TransitionResult;
  }

  /**
   * Build type-specific result based on transition target phase.
   */
  private _buildResult(
    game: Game,
    question: PackageQuestionDTO,
    timer: GameStateTimer | null,
    transitionResult: TransitionResult
  ): {
    success: boolean;
    data: QuestionPickResult;
  } {
    const timerDto = timer?.value() ?? undefined;

    switch (transitionResult.toPhase) {
      case GamePhase.SECRET_QUESTION_TRANSFER: {
        const data =
          transitionResult.data as ChoosingToSecretTransferMutationData;

        const secretData: SecretQuestionPickedBroadcastData = {
          pickerPlayerId: data.pickerPlayerId,
          transferType: data.transferType,
          questionId: data.questionId,
        };

        return {
          success: true,
          data: {
            type: QuestionPickType.SECRET,
            gameId: game.id,
            secretData,
          },
        };
      }

      case GamePhase.STAKE_BIDDING: {
        const data =
          transitionResult.data as ChoosingToStakeBiddingMutationData;

        const biddingTimer = transitionResult.timer ?? data.timer ?? timerDto;

        const stakeData: StakeQuestionPickedBroadcastData = {
          pickerPlayerId: data.pickerPlayerId,
          questionId: data.questionId,
          maxPrice: data.maxPrice,
          biddingOrder: data.biddingOrder,
          timer: biddingTimer ?? {
            durationMs: 0,
            elapsedMs: 0,
            startedAt: new Date(),
            resumedAt: null,
          },
        };

        return {
          success: true,
          data: {
            type: QuestionPickType.STAKE,
            gameId: game.id,
            timer: biddingTimer ?? undefined,
            question,
            stakeData,
            automaticNominalBid: data.automaticBid ?? null,
          },
        };
      }

      case GamePhase.MEDIA_DOWNLOADING:
      case GamePhase.SHOWING: {
        if (timerDto) {
          return {
            success: true,
            data: {
              type: QuestionPickType.NORMAL,
              gameId: game.id,
              timer: timerDto,
              question,
            },
          };
        }

        return {
          success: false,
          data: {
            type: QuestionPickType.NORMAL,
            gameId: game.id,
          },
        };
      }

      case GamePhase.ANSWERING: {
        const questionPickType = game.gameState.stakeQuestionData
          ? QuestionPickType.STAKE
          : game.gameState.secretQuestionData
          ? QuestionPickType.SECRET
          : QuestionPickType.NORMAL;

        return {
          success: true,
          data: {
            type: questionPickType,
            gameId: game.id,
          },
        };
      }

      default:
        return {
          success: false,
          data: {
            type: QuestionPickType.NORMAL,
            gameId: game.id,
          },
        };
    }
  }
}

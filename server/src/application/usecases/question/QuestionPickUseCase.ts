import { TransitionResourceService } from "application/services/game/TransitionResourceService";
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
  type TransitionResources,
  type TransitionResult,
  TransitionTrigger,
} from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import {
  DataMutationConverter,
  type DataMutation
} from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { type PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { type QuestionPickResult } from "domain/types/question/QuestionPickTypes";
import { type QuestionPickMediaPreloadEventPayload } from "domain/types/socket/events/game/QuestionPickMediaPreloadEventPayload";
import { StakeBidSubmitOutputData } from "domain/types/socket/events/game/StakeQuestionEventData";
import { QuestionPickInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { type QuestionPickPayload } from "domain/types/socket/transition/choosing";
import { type StakeBiddingToAnsweringPayload } from "domain/types/socket/transition/special-question";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

/**
 * Handles question picking.
 *
 * Context-aware: receives prefetched game/player/timer from the executor's
 * IN pipeline. Still requires PackageStore read (1 RT, unavoidable) and
 * PhaseTransitionRouter calls for timer management (1-2 RT, unavoidable).
 *
 * For NORMAL questions, emits a preload `question-pick` first. The full
 * `question-data` reveal is emitted only when the media-download gate opens.
 *
 * SECRET and STAKE questions emit events that are identical for all players.
 */
export class QuestionPickUseCase
  implements GameActionHandler<QuestionPickInputData, QuestionPickResult>
{
  constructor(
    private readonly packageStore: PackageStore,
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly transitionResourceService: TransitionResourceService
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
    const transitionResources =
      this.transitionResourceService.fromQuestionWithTheme(questionData);

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
        ...(transitionResources ? { resources: transitionResources } : {}),
      });

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    const initialTransitionResult = transitionResult;
    const preloadMutations = this._buildNormalQuestionPreloadMutations(
      game,
      questionData.question,
      initialTransitionResult
    );

    if (
      initialTransitionResult.toPhase === GamePhase.MEDIA_DOWNLOADING &&
      (questionData.question.questionFiles?.length ?? 0) === 0
    ) {
      transitionResult = await this._autoAdvanceMediaDownloadWhenNoFiles(
        game,
        currentPlayer!,
        initialTransitionResult,
        transitionResources
      );
    }

    // Auto-advance if stake bidding is immediately resolved
    if (
      transitionResult.toPhase === GamePhase.STAKE_BIDDING &&
      game.gameState.stakeQuestionData
    ) {
      transitionResult = await this._autoAdvanceStakeBiddingIfResolved(
        game,
        currentPlayer!,
        transitionResult,
        transitionResources
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
        ...preloadMutations,
        ...DataMutationConverter.mutationFromServiceBroadcasts(
          transitionResult.broadcasts,
          game.id
        ),
      ],
      broadcastGame: game,
    };
  }

  private _buildNormalQuestionPreloadMutations(
    game: Game,
    question: PackageQuestionDTO,
    transitionResult: TransitionResult
  ): DataMutation[] {
    if (
      transitionResult.toPhase !== GamePhase.MEDIA_DOWNLOADING ||
      !transitionResult.timer ||
      !question.id
    ) {
      return [];
    }

    return [
      DataMutationConverter.gameBroadcastMutation(
        game.id,
        SocketIOGameEvents.QUESTION_PICK,
        {
          questionId: question.id,
          questionFiles: question.questionFiles ?? [],
          timer: transitionResult.timer
        } satisfies QuestionPickMediaPreloadEventPayload
      )
    ];
  }

  private async _autoAdvanceMediaDownloadWhenNoFiles(
    game: Game,
    currentPlayer: Player,
    transitionResult: TransitionResult,
    transitionResources?: TransitionResources
  ): Promise<TransitionResult> {
    const autoFinishTransition = await this.phaseTransitionRouter.tryTransition({
      game,
      trigger: TransitionTrigger.CONDITION_MET,
      triggeredBy: {
        playerId: currentPlayer.meta.id,
        isSystem: true
      },
      ...(transitionResources ? { resources: transitionResources } : {})
    });

    if (!autoFinishTransition) {
      return transitionResult;
    }

    return {
      ...autoFinishTransition,
      success: true,
      broadcasts: [
        ...transitionResult.broadcasts,
        ...autoFinishTransition.broadcasts
      ],
      timerMutations: [
        ...(transitionResult.timerMutations ?? []),
        ...(autoFinishTransition.timerMutations ?? [])
      ]
    } satisfies TransitionResult;
  }

  /**
   * Automatically trigger phase transition if stake bidding is ended.
   *
   * For example: no eligible bidders and picker gets auto-bid therefore auto-winning.
   */
  private async _autoAdvanceStakeBiddingIfResolved(
    game: Game,
    currentPlayer: Player,
    transitionResult: TransitionResult,
    transitionResources?: TransitionResources
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
          ...(transitionResources ? { resources: transitionResources } : {}),
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
}

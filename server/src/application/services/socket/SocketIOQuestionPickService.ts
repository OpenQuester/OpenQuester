import { singleton } from "tsyringe";

import { ActionContext } from "domain/types/action/ActionContext";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { QuestionPickLogic } from "domain/logic/question/QuestionPickLogic";
import { QuestionPickPayload } from "domain/types/socket/transition/choosing";
import {
  GamePhase,
  TransitionResult,
  TransitionTrigger,
} from "domain/state-machine/types";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { GameService } from "application/services/game/GameService";
import { StakeBiddingToAnsweringPayload } from "domain/types/socket/transition/special-question";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PlayerGameStatus } from "domain/types/game/PlayerGameStatus";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { StakeBidSubmitOutputData } from "domain/types/socket/events/game/StakeQuestionEventData";
import { Game } from "domain/entities/game/Game";
import { Player } from "domain/entities/game/Player";

@singleton()
export class SocketIOQuestionPickService {
  constructor(
    private socketGameContextService: SocketGameContextService,
    private phaseTransitionRouter: PhaseTransitionRouter,
    private gameService: GameService
  ) {
    //
  }

  public async handleQuestionPick(ctx: ActionContext, questionId: number) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    QuestionActionValidator.validatePickAction({
      game,
      currentPlayer,
      action: QuestionAction.PICK,
    });

    // Validate upfront for fast failure and to reuse full question data later
    const questionData = QuestionPickLogic.validateQuestionPick(
      game,
      questionId
    );

    // Capture eligible players BEFORE any transitions
    // This prevents players who join mid-question from answering
    game.captureQuestionEligiblePlayers();

    // Route transition based on question type/state
    // Possible transitions to: media downloading, stake bidding, secret transfer, answering
    let transitionResult =
      await this.phaseTransitionRouter.tryTransition<QuestionPickPayload>({
        game,
        trigger: TransitionTrigger.USER_ACTION,
        triggeredBy: { playerId: currentPlayer!.meta.id, isSystem: false },
        payload: { questionId },
      });

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    // Auto-advance if stake bidding is immediately resolved (e.g. picker auto-bid wins)
    if (
      transitionResult.toPhase === GamePhase.STAKE_BIDDING &&
      game.gameState.stakeQuestionData // Set only when bidding ended
    ) {
      transitionResult = await this._autoAdvanceStakeBiddingIfResolved(
        game,
        currentPlayer!,
        transitionResult
      );
    }

    // Save mutated game state
    await this.gameService.updateGame(game);

    const timerDto = transitionResult.timer;
    const timer = timerDto ? GameStateTimer.fromDTO(timerDto) : null;

    return {
      game,
      question: questionData.question,
      timer,
      transitionResult,
    };
  }

  /**
   * Automatically trigger phase transition if stake bidding is ended
   *
   * For example no eligible bidders and picker gets auto-bid therefore auto-winning.
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
      // To outbid, player needs score > currentHighestBid
      return p.score > currentHighestBid;
    });

    if (canAnyoneOutbid) {
      return transitionResult;
    }

    // Transition to ANSWERING immediately
    const autoFinishTransition =
      await this.phaseTransitionRouter.tryTransition<StakeBiddingToAnsweringPayload>(
        {
          game,
          trigger: TransitionTrigger.CONDITION_MET,
          triggeredBy: {
            playerId: currentPlayer!.meta.id,
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
      // Timer is null on last bid with phase complete
      data.timer = undefined;
    }

    return {
      ...autoFinishTransition,
      success: true,
      broadcasts: [
        ...transitionResult.broadcasts,
        ...autoFinishTransition.broadcasts,
      ],
    } satisfies TransitionResult;
  }
}

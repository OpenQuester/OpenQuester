import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { SecretQuestionPickedBroadcastData } from "domain/types/socket/events/game/SecretQuestionPickedEventPayload";
import {
  StakeBidSubmitOutputData,
  StakeBidType,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import { StakeQuestionPickedBroadcastData } from "domain/types/socket/events/game/StakeQuestionPickedEventPayload";
import { StakeQuestionWinnerEventData } from "domain/types/socket/events/game/StakeQuestionWinnerEventData";
import { QuestionPickInputData } from "domain/types/socket/events/SocketEventInterfaces";

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
    private readonly socketIOQuestionService: SocketIOQuestionService
  ) {
    //
  }

  public async execute(
    action: GameAction<QuestionPickInputData>
  ): Promise<GameActionHandlerResult<QuestionPickResult>> {
    const result = await this.socketIOQuestionService.handleQuestionPick(
      action.socketId,
      action.payload.questionId
    );

    const { game, question, timer, specialQuestionData, automaticNominalBid } =
      result;

    // Handle SECRET question
    if (question.type === PackageQuestionType.SECRET && specialQuestionData) {
      const secretData = specialQuestionData as SecretQuestionGameData;
      const broadcastData: SecretQuestionPickedBroadcastData = {
        pickerPlayerId: secretData.pickerPlayerId,
        transferType: secretData.transferType,
        questionId: secretData.questionId,
      };

      const broadcasts: SocketEventBroadcast<unknown>[] = [
        {
          event: SocketIOGameEvents.SECRET_QUESTION_PICKED,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        } satisfies SocketEventBroadcast<SecretQuestionPickedBroadcastData>,
      ];

      return {
        success: true,
        data: {
          type: QuestionPickType.SECRET,
          gameId: game.id,
          secretData: broadcastData,
        },
        broadcasts,
      };
    }

    // Handle STAKE question
    if (question.type === PackageQuestionType.STAKE && specialQuestionData) {
      const stakeData = specialQuestionData as StakeQuestionGameData;
      const broadcastData: StakeQuestionPickedBroadcastData = {
        pickerPlayerId: stakeData.pickerPlayerId,
        questionId: stakeData.questionId,
        maxPrice: stakeData.maxPrice,
        biddingOrder: stakeData.biddingOrder,
        timer: timer?.value() ?? {
          durationMs: 0,
          elapsedMs: 0,
          startedAt: new Date(),
          resumedAt: null,
        },
      };

      const broadcasts: SocketEventBroadcast<unknown>[] = [
        {
          event: SocketIOGameEvents.STAKE_QUESTION_PICKED,
          data: broadcastData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        } satisfies SocketEventBroadcast<StakeQuestionPickedBroadcastData>,
      ];

      // If automatic nominal bid happened (only one eligible player)
      if (automaticNominalBid && timer) {
        const isPhaseComplete = !stakeData.biddingPhase;

        // Emit the automatic bid event
        broadcasts.push({
          event: SocketIOGameEvents.STAKE_BID_SUBMIT,
          data: {
            playerId: automaticNominalBid.playerId,
            bidAmount: automaticNominalBid.bidAmount,
            bidType: StakeBidType.NORMAL,
            isPhaseComplete,
            nextBidderId: isPhaseComplete
              ? null
              : stakeData.biddingOrder[stakeData.currentBidderIndex] || null,
            timer: timer.value()!,
          } satisfies StakeBidSubmitOutputData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        } satisfies SocketEventBroadcast<StakeBidSubmitOutputData>);

        // Emit winner event if bidding is complete
        if (isPhaseComplete && stakeData.winnerPlayerId) {
          broadcasts.push({
            event: SocketIOGameEvents.STAKE_QUESTION_WINNER,
            data: {
              winnerPlayerId: stakeData.winnerPlayerId,
              finalBid: stakeData.highestBid,
            } satisfies StakeQuestionWinnerEventData,
            target: SocketBroadcastTarget.GAME,
            gameId: game.id,
          } satisfies SocketEventBroadcast<StakeQuestionWinnerEventData>);

          // Question data for automatic bid completion can be broadcast to all
          // since stake question answer is revealed to everyone after winner determined
          broadcasts.push({
            event: SocketIOGameEvents.QUESTION_DATA,
            data: {
              data: question,
              timer: timer.value()!,
            } satisfies GameQuestionDataEventPayload,
            target: SocketBroadcastTarget.GAME,
            gameId: game.id,
          } satisfies SocketEventBroadcast<GameQuestionDataEventPayload>);
        }
      }

      return {
        success: true,
        data: {
          type: QuestionPickType.STAKE,
          gameId: game.id,
          timer: timer?.value() ?? undefined,
          question: question,
          stakeData: broadcastData,
          automaticNominalBid: automaticNominalBid ?? null,
        },
        broadcasts,
      };
    }

    // NORMAL question - NO broadcasts here!
    // Socket handler's afterBroadcast will do personalized per-socket emissions
    // because showman sees full question data while players see filtered version
    if (timer) {
      return {
        success: true,
        data: {
          type: QuestionPickType.NORMAL,
          gameId: game.id,
          timer: timer.value()!,
          question: question,
        },
        broadcasts: [], // Empty! Socket handler does personalized broadcasts
      };
    }

    // Fallback - shouldn't happen for normal questions
    return {
      success: false,
      data: {
        type: QuestionPickType.NORMAL,
        gameId: game.id,
      },
      broadcasts: [],
    };
  }
}

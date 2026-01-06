import { GamePhase } from "domain/state-machine/types";
import {
  SocketBroadcastTarget,
  SocketEventBroadcast,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameAction } from "domain/types/action/GameAction";
import {
  GameActionHandler,
  GameActionHandlerResult,
} from "domain/types/action/GameActionHandler";
import { createActionContextFromAction } from "domain/types/action/ActionContext";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";
import { QuestionPickInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import {
  ChoosingToSecretTransferMutationData,
  ChoosingToStakeBiddingMutationData,
} from "domain/types/socket/transition/choosing";
import { SecretQuestionPickedBroadcastData } from "domain/types/socket/events/game/SecretQuestionPickedEventPayload";
import { StakeQuestionPickedBroadcastData } from "domain/types/socket/events/game/StakeQuestionPickedEventPayload";
import { SocketIOQuestionPickService } from "src/application/services/socket/SocketIOQuestionPickService";

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
    private readonly socketIOQuestionPickService: SocketIOQuestionPickService
  ) {
    //
  }

  public async execute(
    action: GameAction<QuestionPickInputData>
  ): Promise<GameActionHandlerResult<QuestionPickResult>> {
    const { game, question, timer, transitionResult } =
      await this.socketIOQuestionPickService.handleQuestionPick(
        createActionContextFromAction(action),
        action.payload.questionId
      );

    const timerDto = timer?.value() ?? undefined;
    const broadcasts = this.mapBroadcasts(transitionResult.broadcasts);

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
          broadcasts,
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
          broadcasts,
        };
      }

      case GamePhase.MEDIA_DOWNLOADING:
      case GamePhase.SHOWING: {
        // Normal flow (or fallback without eligible players)
        if (timerDto) {
          return {
            success: true,
            data: {
              type: QuestionPickType.NORMAL,
              gameId: game.id,
              timer: timerDto,
              question,
            },
            broadcasts,
          };
        }

        return {
          success: false,
          data: {
            type: QuestionPickType.NORMAL,
            gameId: game.id,
          },
          broadcasts,
        };
      }

      default:
        return {
          success: false,
          data: {
            type: QuestionPickType.NORMAL,
            gameId: game.id,
          },
          broadcasts,
        };
    }
  }

  private mapBroadcasts(
    events: BroadcastEvent[]
  ): SocketEventBroadcast<unknown>[] {
    return events.map((event) => ({
      event: event.event,
      data: event.data,
      target: SocketBroadcastTarget.GAME,
      gameId: event.room,
      useRoleBasedBroadcast: event.roleFilter ?? false,
    }));
  }
}

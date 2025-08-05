import { Socket } from "socket.io";

import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventBroadcast,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import {
  StakeBidSubmitInputData,
  StakeBidSubmitOutputData,
} from "domain/types/socket/events/game/StakeQuestionEventData";
import { StakeQuestionWinnerEventData } from "domain/types/socket/events/game/StakeQuestionWinnerEventData";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class StakeBidSubmitEventHandler extends BaseSocketEventHandler<
  StakeBidSubmitInputData,
  StakeBidSubmitOutputData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    private readonly questionService: SocketIOQuestionService
  ) {
    super(socket, eventEmitter, logger);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.STAKE_BID_SUBMIT;
  }

  protected async beforeHandle(
    _data: StakeBidSubmitInputData,
    _context: SocketEventContext
  ): Promise<void> {
    //
  }

  protected async validateInput(
    data: StakeBidSubmitInputData
  ): Promise<StakeBidSubmitInputData> {
    return GameValidator.validateStakeBid(data);
  }

  protected async authorize(
    _data: StakeBidSubmitInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer
    // Only players can submit bids and only the current bidder
  }

  protected async execute(
    data: StakeBidSubmitInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<StakeBidSubmitOutputData>> {
    const {
      game,
      playerId,
      bidAmount,
      bidType,
      isPhaseComplete,
      nextBidderId,
      winnerPlayerId,
      questionData,
      timer,
    } = await this.questionService.handleStakeBidSubmit(this.socket.id, data);

    // Assign context variables for logging
    context.gameId = game.id;
    context.userId = this.socket.userId;

    const outputData: StakeBidSubmitOutputData = {
      playerId,
      bidAmount,
      bidType,
      isPhaseComplete,
      nextBidderId,
      timer,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.STAKE_BID_SUBMIT,
        data: outputData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<StakeBidSubmitOutputData>,
    ];

    // If bidding phase is complete, announce winner and start question
    if (isPhaseComplete && winnerPlayerId && questionData && timer) {
      // Get the final winning bid amount from the stake question data
      const finalBid = game.gameState.stakeQuestionData?.highestBid || null;

      // Emit winner announcement
      broadcasts.push({
        event: SocketIOGameEvents.STAKE_QUESTION_WINNER,
        data: {
          winnerPlayerId,
          finalBid,
        } satisfies StakeQuestionWinnerEventData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<StakeQuestionWinnerEventData>);

      // Emit question data separately for everyone to see
      broadcasts.push({
        event: SocketIOGameEvents.QUESTION_DATA,
        data: {
          data: questionData,
          timer,
        } satisfies GameQuestionDataEventPayload,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<GameQuestionDataEventPayload>);
    }

    return {
      success: true,
      data: outputData,
      broadcast: broadcasts,
    };
  }
}

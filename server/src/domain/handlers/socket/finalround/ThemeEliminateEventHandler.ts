import { Socket } from "socket.io";

import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { FinalRoundPhase } from "domain/enums/FinalRoundPhase";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventBroadcast,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  FinalBidSubmitOutputData,
  FinalPhaseCompleteEventData,
  FinalQuestionEventData,
  ThemeEliminateInputData,
  ThemeEliminateOutputData,
} from "domain/types/socket/events/FinalRoundEventData";
import { GameValidator } from "domain/validators/GameValidator";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class ThemeEliminateEventHandler extends BaseSocketEventHandler<
  ThemeEliminateInputData,
  ThemeEliminateOutputData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    private readonly finalRoundService: FinalRoundService
  ) {
    super(socket, eventEmitter);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.THEME_ELIMINATE;
  }

  protected async validateInput(
    data: ThemeEliminateInputData
  ): Promise<ThemeEliminateInputData> {
    return GameValidator.validateThemeElimination(data);
  }

  protected async authorize(
    _data: ThemeEliminateInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization will be handled by the service layer
    // Players can eliminate themes on their turn, showman can eliminate anytime
    // Spectators cannot eliminate themes
  }

  protected async execute(
    data: ThemeEliminateInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<ThemeEliminateOutputData>> {
    const { game, eliminatedBy, themeId, nextPlayerId, isPhaseComplete } =
      await this.finalRoundService.handleThemeEliminate(
        this.socket.id,
        data.themeId
      );

    // Update context with game ID for logs and further processing
    context.gameId = game.id;

    const outputData: ThemeEliminateOutputData = {
      themeId,
      eliminatedBy,
      nextPlayerId,
    };

    const broadcasts: SocketEventBroadcast<unknown>[] = [
      {
        event: SocketIOGameEvents.THEME_ELIMINATE,
        data: outputData,
        target: SocketBroadcastTarget.GAME,
        gameId: game.id,
      } satisfies SocketEventBroadcast<ThemeEliminateOutputData>,
    ];

    // If phase is complete (moved to bidding), handle automatic bidding
    if (isPhaseComplete) {
      // Initialize bidding phase with automatic bids
      const biddingPhaseResult =
        await this.finalRoundService.initializeBiddingPhase(game.id);

      // Add automatic bid events to broadcasts
      for (const autoBid of biddingPhaseResult.automaticBids) {
        broadcasts.push({
          event: SocketIOGameEvents.FINAL_BID_SUBMIT,
          data: {
            playerId: autoBid.playerId,
            bidAmount: autoBid.bidAmount,
            isAutomatic: true,
          } satisfies FinalBidSubmitOutputData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        } satisfies SocketEventBroadcast<FinalBidSubmitOutputData>);
      }

      if (biddingPhaseResult.shouldTransitionToQuestion) {
        // Immediate transition to question phase
        if (biddingPhaseResult.questionData) {
          broadcasts.push({
            event: SocketIOGameEvents.FINAL_QUESTION_DATA,
            data: {
              questionData: biddingPhaseResult.questionData,
            } satisfies FinalQuestionEventData,
            target: SocketBroadcastTarget.GAME,
            gameId: game.id,
          } satisfies SocketEventBroadcast<FinalQuestionEventData>);
        }
      } else {
        // Send phase complete event with timer for remaining players
        broadcasts.push({
          event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
          data: {
            phase: FinalRoundPhase.THEME_ELIMINATION,
            nextPhase: FinalRoundPhase.BIDDING,
            timer: biddingPhaseResult.timer,
          } satisfies FinalPhaseCompleteEventData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        } satisfies SocketEventBroadcast<FinalPhaseCompleteEventData>);
      }
    }

    return {
      success: true,
      data: outputData,
      broadcast: broadcasts,
    };
  }
}

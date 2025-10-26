import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
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
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class ThemeEliminateEventHandler extends BaseSocketEventHandler<
  ThemeEliminateInputData,
  ThemeEliminateOutputData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly finalRoundService: FinalRoundService,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.THEME_ELIMINATE;
  }

  protected async getGameIdForAction(
    _data: ThemeEliminateInputData,
    context: SocketEventContext
  ): Promise<string | null> {
    try {
      const gameContext = await this.socketGameContextService.fetchGameContext(
        context.socketId
      );
      return gameContext.game?.id ?? null;
    } catch {
      return null;
    }
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
        context.socketId,
        data.themeId
      );

    // Assign context variables for logging
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

      // Always emit FINAL_PHASE_COMPLETE for theme_elimination → bidding transition
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

      // If all players auto-bid (indicated by presence of questionData),
      // emit question data and bidding → answering phase complete
      if (biddingPhaseResult.questionData) {
        broadcasts.push({
          event: SocketIOGameEvents.FINAL_QUESTION_DATA,
          data: {
            questionData: biddingPhaseResult.questionData,
          } satisfies FinalQuestionEventData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        } satisfies SocketEventBroadcast<FinalQuestionEventData>);

        // Also emit FINAL_PHASE_COMPLETE for bidding → answering transition
        broadcasts.push({
          event: SocketIOGameEvents.FINAL_PHASE_COMPLETE,
          data: {
            phase: FinalRoundPhase.BIDDING,
            nextPhase: FinalRoundPhase.ANSWERING,
            timer: biddingPhaseResult.timer,
          } satisfies FinalPhaseCompleteEventData,
          target: SocketBroadcastTarget.GAME,
          gameId: game.id,
        } satisfies SocketEventBroadcast<FinalPhaseCompleteEventData>);
      }
      // If some players need to bid manually, the timer is already set for bidding phase
    }

    return {
      success: true,
      data: outputData,
      broadcast: broadcasts,
    };
  }
}

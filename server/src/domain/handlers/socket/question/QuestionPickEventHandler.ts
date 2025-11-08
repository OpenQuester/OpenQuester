import { Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { GameActionType } from "domain/enums/GameActionType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import {
  BaseSocketEventHandler,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { StakeQuestionGameData } from "domain/types/dto/game/state/StakeQuestionGameData";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SocketEventEmitter } from "domain/types/socket/EmitTarget";
import { PlayerBidData } from "domain/types/socket/events/FinalRoundEventData";
import { GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { SecretQuestionPickedBroadcastData } from "domain/types/socket/events/game/SecretQuestionPickedEventPayload";
import { StakeBidType } from "domain/types/socket/events/game/StakeQuestionEventData";
import { StakeQuestionPickedBroadcastData } from "domain/types/socket/events/game/StakeQuestionPickedEventPayload";
import { StakeQuestionWinnerEventData } from "domain/types/socket/events/game/StakeQuestionWinnerEventData";
import { QuestionPickInputData } from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class QuestionPickEventHandler extends BaseSocketEventHandler<
  QuestionPickInputData,
  GameQuestionDataEventPayload
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger,
    actionExecutor: GameActionExecutor,
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly socketGameContextService: SocketGameContextService
  ) {
    super(socket, eventEmitter, logger, actionExecutor);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.QUESTION_PICK;
  }

  protected async getGameIdForAction(
    _data: QuestionPickInputData,
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

  protected override getActionType(): GameActionType {
    return GameActionType.QUESTION_PICK;
  }

  protected async validateInput(
    data: QuestionPickInputData
  ): Promise<QuestionPickInputData> {
    return GameValidator.validatePickQuestion(data);
  }

  protected async authorize(
    _data: QuestionPickInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Authorization happens in the service layer
  }

  protected async execute(
    data: QuestionPickInputData,
    context: SocketEventContext
  ): Promise<SocketEventResult<GameQuestionDataEventPayload>> {
    const result = await this.socketIOQuestionService.handleQuestionPick(
      context.socketId,
      data.questionId
    );

    // Check if this is a secret question with special data (not auto-skipped)
    if (
      result.question.type === PackageQuestionType.SECRET &&
      result.specialQuestionData
    ) {
      // For secret questions, we need to emit a different event
      // Return an empty successful result and handle the secret question event separately
      return {
        success: true,
        data: {
          data: result.question,
          timer: { durationMs: 0, elapsedMs: 0, startedAt: new Date() },
        },
        context: {
          ...context,
          gameId: result.game.id,
          customData: {
            game: result.game,
            isSecretQuestion: true,
            secretQuestionData:
              result.specialQuestionData as SecretQuestionGameData,
          },
        },
      };
    }

    // Check if this is a stake question with special data (not auto-skipped)
    if (
      result.question.type === PackageQuestionType.STAKE &&
      result.specialQuestionData
    ) {
      // For stake questions, we need to emit a different event
      // Return an empty successful result and handle the stake question event separately
      return {
        success: true,
        data: {
          data: result.question,
          timer: result.timer?.value() ?? {
            durationMs: 0,
            elapsedMs: 0,
            startedAt: new Date(),
          },
        },
        context: {
          ...context,
          gameId: result.game.id,
          customData: {
            game: result.game,
            isStakeQuestion: true,
            stakeQuestionData:
              result.specialQuestionData as StakeQuestionGameData,
            timer: result.timer,
            automaticNominalBid: result.automaticNominalBid,
            questionData: result.question,
          },
        },
      };
    }

    // Normal question flow (timer should not be null for non-secret questions)
    if (result.timer) {
      const { question, game } = result;
      const timer = result.timer;

      const resultData: GameQuestionDataEventPayload = {
        data: question,
        timer: timer.value()!,
      };

      return {
        success: true,
        data: resultData,
        context: {
          ...context,
          gameId: game.id,
          customData: {
            game: game,
            question: question,
            timer: timer,
          },
        },
      };
    }

    return {
      success: false,
      data: {
        data: result.question,
        timer: { durationMs: 0, elapsedMs: 0, startedAt: new Date() },
      },
      context: {
        ...context,
        gameId: result.game.id,
        customData: {
          game: result.game,
          question: null,
          timer: null,
        },
      },
    };
  }

  protected async afterBroadcast(
    result: SocketEventResult<GameQuestionDataEventPayload>,
    _context: SocketEventContext
  ): Promise<void> {
    const customData = result.context?.customData;
    if (!customData) return;

    if (customData.isSecretQuestion) {
      await this._handleSecretQuestionBroadcast(customData);
      return;
    }

    if (customData.isStakeQuestion) {
      await this._handleStakeQuestionBroadcast(customData);
      return;
    }

    await this._handleNormalQuestionBroadcast(customData);
  }

  private async _handleSecretQuestionBroadcast(
    customData: Record<string, unknown>
  ): Promise<void> {
    const secretQuestionData =
      customData.secretQuestionData as SecretQuestionGameData | null;

    const game = customData.game as Game;

    if (!secretQuestionData || !game) return;

    const secretEventBroadcastData: SecretQuestionPickedBroadcastData = {
      pickerPlayerId: secretQuestionData.pickerPlayerId,
      transferType: secretQuestionData.transferType,
      questionId: secretQuestionData.questionId,
    };

    this.eventEmitter.emit(
      SocketIOGameEvents.SECRET_QUESTION_PICKED,
      secretEventBroadcastData,
      { emitter: SocketEventEmitter.IO, gameId: game.id }
    );
  }

  private async _handleStakeQuestionBroadcast(
    customData: Record<string, unknown>
  ): Promise<void> {
    const stakeQuestionData =
      customData.stakeQuestionData as StakeQuestionGameData | null;

    const timer = customData.timer as GameStateTimer | null;
    const game = customData.game as Game;
    const questionData = customData.questionData as PackageQuestionDTO | null;

    if (!stakeQuestionData || !game || !timer || !questionData) return;

    this.emitStakeQuestionPicked(stakeQuestionData, timer, game);

    // Handle automatic nominal bid if present
    const automaticNominalBid =
      customData.automaticNominalBid as PlayerBidData | null;

    if (automaticNominalBid) {
      this.emitAutomaticBid(
        automaticNominalBid,
        stakeQuestionData,
        timer,
        game,
        questionData
      );
    }
  }

  private emitStakeQuestionPicked(
    stakeQuestionData: StakeQuestionGameData,
    timer: GameStateTimer,
    game: Game
  ): void {
    const stakeEventBroadcastData: StakeQuestionPickedBroadcastData = {
      pickerPlayerId: stakeQuestionData.pickerPlayerId,
      questionId: stakeQuestionData.questionId,
      maxPrice: stakeQuestionData.maxPrice,
      biddingOrder: stakeQuestionData.biddingOrder,
      timer: timer.value()!,
    };

    this.eventEmitter.emit(
      SocketIOGameEvents.STAKE_QUESTION_PICKED,
      stakeEventBroadcastData,
      { emitter: SocketEventEmitter.IO, gameId: game.id }
    );
  }

  private emitAutomaticBid(
    automaticNominalBid: PlayerBidData,
    stakeQuestionData: StakeQuestionGameData,
    timer: GameStateTimer,
    game: Game,
    questionData: PackageQuestionDTO
  ): void {
    const isPhaseComplete = !stakeQuestionData.biddingPhase;

    const stakeBidSubmitData = {
      playerId: automaticNominalBid.playerId,
      bidAmount: automaticNominalBid.bidAmount,
      bidType: StakeBidType.NORMAL,
      isPhaseComplete,
      nextBidderId: isPhaseComplete
        ? null
        : stakeQuestionData.biddingOrder[
            stakeQuestionData.currentBidderIndex
          ] || null,
      timer: timer.value()!,
    };

    this.eventEmitter.emit(
      SocketIOGameEvents.STAKE_BID_SUBMIT,
      stakeBidSubmitData,
      { emitter: SocketEventEmitter.IO, gameId: game.id }
    );

    // Emit winner event if bidding is complete
    if (isPhaseComplete && stakeQuestionData.winnerPlayerId) {
      const winnerEventData: StakeQuestionWinnerEventData = {
        winnerPlayerId: stakeQuestionData.winnerPlayerId,
        finalBid: stakeQuestionData.highestBid,
      };

      this.eventEmitter.emit(
        SocketIOGameEvents.STAKE_QUESTION_WINNER,
        winnerEventData,
        { emitter: SocketEventEmitter.IO, gameId: game.id }
      );

      // Emit question data separately for automatic bidding completion
      const questionDataPayload: GameQuestionDataEventPayload = {
        data: questionData,
        timer: timer.value()!,
      };

      this.eventEmitter.emit(
        SocketIOGameEvents.QUESTION_DATA,
        questionDataPayload,
        { emitter: SocketEventEmitter.IO, gameId: game.id }
      );
    }
  }

  private async _handleNormalQuestionBroadcast(
    customData: Record<string, unknown>
  ): Promise<void> {
    const { game, question, timer } = customData as {
      game: Game;
      question: PackageQuestionDTO;
      timer: GameStateTimer;
    };

    if (!game || !question || !timer) return;

    const sockets = await this.socket.nsp.in(game.id).fetchSockets();
    const socketIds = sockets.map((s) => s.id);

    const broadcastMap =
      await this.socketIOQuestionService.getPlayersBroadcastMap(
        socketIds,
        game,
        question
      );

    const timerValue = timer.value();
    if (!timerValue) return;

    for (const [socketId, questionData] of broadcastMap) {
      this.eventEmitter.emitToSocket<GameQuestionDataEventPayload>(
        SocketIOGameEvents.QUESTION_DATA,
        {
          data: questionData,
          timer: timerValue,
        },
        socketId
      );
    }
  }
}

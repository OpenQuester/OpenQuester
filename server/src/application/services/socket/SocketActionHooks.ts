import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { RealtimeEvents } from "application/ports/realtime/RealtimeEvent";
import { type RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { UserNotificationRoomService } from "application/services/socket/UserNotificationRoomService";
import { type Game } from "domain/entities/game/Game";
import { GameActionType } from "domain/enums/GameActionType";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { type GameAction, type GameActionResult } from "domain/types/action/GameAction";
import { type GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { type PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { type QuestionPickResult, QuestionPickType } from "domain/types/question/QuestionPickTypes";
import { type SecretQuestionTransferResult } from "domain/types/question/SecretQuestionTransferTypes";
import { type GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import {
  type GameJoinOutputData,
  type GameLeaveBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { type SecretQuestionTransferBroadcastData } from "domain/types/socket/game/SecretQuestionTransferData";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { type ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

export interface AfterExecutionHookContext {
  action: GameAction;
  game: Game;
  result: GameActionResult;
}

export type AfterExecutionHook = (ctx: AfterExecutionHookContext) => Promise<void>;

/**
 * Runs post-execution socket side effects after a game action is fully
 * processed by the queue executor.
 */
@singleton()
export class SocketActionHooks {
  private readonly hooks = new Map<GameActionType, AfterExecutionHook>();

  public constructor(
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly userNotificationRoomService: UserNotificationRoomService,
    private readonly packageStore: PackageStore,
    @inject(DI_TOKENS.RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    this.hooks.set(GameActionType.JOIN, this.afterJoinGame.bind(this));
    this.hooks.set(GameActionType.LEAVE, this.afterLeaveGame.bind(this));
    this.hooks.set(GameActionType.QUESTION_PICK, this.afterQuestionPick.bind(this));
    this.hooks.set(
      GameActionType.SECRET_QUESTION_TRANSFER,
      this.afterSecretQuestionTransfer.bind(this)
    );
  }

  /**
   * Run the configured post-execution hook for the completed action.
   */
  public async run(action: GameAction, result: GameActionResult, game: Game): Promise<void> {
    if (result.data === undefined) {
      return;
    }

    const hook = this.hooks.get(action.type);
    if (!hook) {
      return;
    }

    try {
      await hook({ action, game, result });
    } catch (error) {
      this.logger.warn("Failed to run socket action hook", {
        prefix: LogPrefix.SOCKET,
        actionId: action.id,
        actionType: action.type,
        gameId: action.gameId,
        socketId: action.socketId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async afterJoinGame({ action, game, result }: AfterExecutionHookContext): Promise<void> {
    if (!result.success || !result.data) {
      return;
    }

    this.realtimeGateway.joinRoom(action.socketId, action.gameId);

    const data = result.data as GameJoinOutputData;
    const currentUserId = action.playerId;

    const existingPlayerIds = data.players
      .filter((p) => p.meta.id !== currentUserId)
      .map((p) => p.meta.id);

    if (existingPlayerIds.length > 0) {
      await this.userNotificationRoomService.subscribeToMultipleUserNotifications(
        action.socketId,
        existingPlayerIds
      );
    }

    await this.emitCurrentQuestionDataToJoinedSocket(action, game);

    if (data.players.length > 1 && currentUserId) {
      await this.userNotificationRoomService.subscribeGameToUserNotifications(
        action.gameId,
        currentUserId
      );
    }
  }

  private async emitCurrentQuestionDataToJoinedSocket(
    action: GameAction,
    game: Game
  ): Promise<void> {
    const currentQuestion = game.gameState.currentQuestion;
    const timer = game.gameState.timer;

    if (!currentQuestion?.id || !timer) {
      return;
    }

    const questionWithTheme = await this.packageStore.getQuestionWithTheme(
      game.id,
      currentQuestion.id
    );

    if (!questionWithTheme) {
      return;
    }

    const joinedPlayer = game.getPlayer(action.playerId, {
      fetchDisconnected: false
    });
    const questionData =
      joinedPlayer?.role === PlayerRole.SHOWMAN
        ? questionWithTheme.question
        : GameQuestionMapper.mapToSimpleQuestion(questionWithTheme.question);

    this.realtimeGateway.publish(
      RealtimeEvents.toSocket(action.socketId, SocketIOGameEvents.QUESTION_DATA, {
        data: questionData,
        timer,
        questionEligiblePlayers: game.getQuestionEligiblePlayers()
      } satisfies GameQuestionDataEventPayload)
    );
  }

  private async afterLeaveGame({ action, game, result }: AfterExecutionHookContext): Promise<void> {
    const allPlayerIds = game.players.map((p) => p.meta.id);

    try {
      await this.userNotificationRoomService.unsubscribeFromMultipleUserNotifications(
        action.socketId,
        allPlayerIds
      );

      const data = result.data as GameLeaveBroadcastData | undefined;
      if (data && data.user !== -1) {
        await this.userNotificationRoomService.unsubscribeGameFromUserNotifications(
          action.gameId,
          data.user
        );
      }
    } catch (error) {
      this.logger.error(
        `Could not clean up user notification rooms for game ${action.gameId}: ${error}`,
        { prefix: LogPrefix.NOTIFICATION }
      );
    }

    this.realtimeGateway.leaveRoom(action.socketId, action.gameId);
  }

  private async afterQuestionPick({ game, result }: AfterExecutionHookContext): Promise<void> {
    if (!result.data) {
      return;
    }

    const data = result.data as QuestionPickResult;
    const { type, question, timer } = data;

    if (type !== QuestionPickType.NORMAL || !question || !timer) {
      return;
    }

    await this.emitPersonalizedQuestionData(game, data.gameId, question, timer);
  }

  private async afterSecretQuestionTransfer({
    game,
    result
  }: AfterExecutionHookContext): Promise<void> {
    if (!result.data) {
      return;
    }

    const data = result.data as SecretQuestionTransferResult;
    const { gameId, timer, question, fromPlayerId, toPlayerId, questionId } = data;

    const transferData: SecretQuestionTransferBroadcastData = {
      fromPlayerId,
      toPlayerId,
      questionId
    };

    this.realtimeGateway.publish(
      RealtimeEvents.toRoom(gameId, SocketIOGameEvents.SECRET_QUESTION_TRANSFER, transferData)
    );

    if (!timer || !question) {
      return;
    }

    await this.emitPersonalizedQuestionData(game, gameId, question, timer);
  }

  private async emitPersonalizedQuestionData(
    game: Game,
    gameId: string,
    question: PackageQuestionDTO,
    timer: GameStateTimerDTO
  ): Promise<void> {
    const socketIds = await this.realtimeGateway.getRoomSocketIds(gameId);

    const broadcastMap = await this.socketIOQuestionService.mapSocketToQuestionPayload(
      socketIds,
      game,
      question
    );

    for (const [sid, questionData] of broadcastMap) {
      this.realtimeGateway.publish(
        RealtimeEvents.toSocket(sid, SocketIOGameEvents.QUESTION_DATA, {
          data: questionData,
          timer,
          questionEligiblePlayers: game.getQuestionEligiblePlayers()
        } satisfies GameQuestionDataEventPayload)
      );
    }
  }
}

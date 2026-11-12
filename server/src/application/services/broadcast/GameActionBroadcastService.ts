import { inject, singleton } from "tsyringe";

import { DI_TOKENS } from "shared/di/tokens";
import { RealtimeEvents } from "application/ports/realtime/RealtimeEvent";
import { type RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { projectAnswerReveal } from "domain/mappers/projectAnswerReveal";
import { projectScriptQuestion, projectScriptState } from "domain/mappers/projectScriptState";
import { PlayerRole } from "domain/types/game/PlayerRole";
import type { QuestionFinishEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import type {
  FinalBidSubmitOutputData,
  FinalQuestionEventData
} from "domain/types/socket/events/FinalRoundEventData";
import { Game } from "domain/entities/game/Game";
import {
  SocketIOEvents,
  SocketIOGameEvents,
  SocketIOUserEvents
} from "domain/enums/SocketIOEvents";
import { SocketBroadcastTarget } from "domain/enums/SocketBroadcastTarget";
import type { QuestionScriptScoreEffect } from "domain/logic/question/QuestionScriptLogic";
import { type PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { type SocketEventBroadcast } from "domain/types/socket/SocketEventBroadcast";
import { ErrorEventPayload } from "domain/types/socket/events/ErrorEventPayload";
import { type GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";

interface ScriptBroadcastSource {
  question: PackageQuestionDTO | null;
  scores: { playerId: number; score: number }[];
  outcomes?: QuestionScriptScoreEffect[];
}

type IOEvent = SocketIOEvents | SocketIOGameEvents | SocketIOUserEvents;

/**
 * Broadcast service for emitting events across server instances.
 *
 * Uses Socket.IO's io.to() which works cross-instance with Redis adapter.
 * This service is used by GameActionExecutor to emit results/errors
 * to the original socket that submitted an action, regardless of which
 * server instance processes the action.
 */
@singleton()
export class GameActionBroadcastService {
  constructor(
    @inject(DI_TOKENS.RealtimeGateway) private readonly realtimeGateway: RealtimeGateway,
    private readonly questionService: SocketIOQuestionService,
    private readonly socketUserDataService: SocketUserDataService,
    @inject(DI_TOKENS.Logger) private readonly logger: ILogger
  ) {
    //
  }

  /**
   * Emit error to original socket that submitted the action.
   * Works cross-instance via Redis adapter.
   */
  public emitError(socketId: string, message: string): void {
    try {
      void this.realtimeGateway.publish(
        RealtimeEvents.toSocket(socketId, SocketIOEvents.ERROR, {
          message
        } satisfies ErrorEventPayload)
      );
    } catch (error) {
      // Socket might have disconnected, log but don't throw
      this.logger.debug(`Failed to emit error to socket ${socketId}: ${error}`, {
        prefix: LogPrefix.ACTION_BROADCAST
      });
    }
  }

  /**
   * Emit broadcasts from action handler result.
   * @param broadcasts The broadcasts to emit
   * @param game Game entity for targeting
   */
  public async emitBroadcasts(broadcasts: SocketEventBroadcast[], game: Game): Promise<void> {
    for (const broadcast of broadcasts) {
      const gameId = broadcast.gameId ?? game.id;

      switch (broadcast.target) {
        case SocketBroadcastTarget.SOCKET:
          // Emit directly to specific socket if socketId provided
          if (broadcast.socketId) {
            this.realtimeGateway.publish(
              RealtimeEvents.toSocket(broadcast.socketId, broadcast.event, broadcast.data)
            );
          } else if (gameId) {
            // Fallback to game room (socket should be in room)
            this.realtimeGateway.publish(
              RealtimeEvents.toRoom(gameId, broadcast.event, broadcast.data)
            );
          }

          break;

        case SocketBroadcastTarget.GAME:
          if (gameId) {
            await this.handleRoleBasedBroadcasts(gameId, broadcast, game);
          }

          break;

        case SocketBroadcastTarget.ALL:
        default:
          this.realtimeGateway.publish(RealtimeEvents.toAll(broadcast.event, broadcast.data));
          break;
      }
    }
  }

  private async handleRoleBasedBroadcasts(
    gameId: string,
    broadcast: SocketEventBroadcast,
    game: Game
  ): Promise<void> {
    const { event, data, useRoleBasedBroadcast } = broadcast;
    if (event === SocketIOGameEvents.QUESTION_SCRIPT_STATE) {
      await this.emitScriptState(game, data as ScriptBroadcastSource);
      return;
    }
    if (event === SocketIOGameEvents.FINAL_BID_SUBMIT) {
      await this.emitFinalBid(gameId, data as FinalBidSubmitOutputData);
      return;
    }

    if (
      event === SocketIOGameEvents.QUESTION_FINISH &&
      (data as QuestionFinishEventPayload).answerTextItems?.some(
        (item) => item.placement === "replic"
      )
    ) {
      await this.emitAnswerReveal(gameId, data as QuestionFinishEventPayload, game);
      return;
    }

    if (!useRoleBasedBroadcast) {
      this.realtimeGateway.publish(RealtimeEvents.toRoom(gameId, event, data));
      return;
    }

    if (event === SocketIOGameEvents.QUESTION_DATA) {
      await this.emitQuestionDataWithRoleBasedFiltering(gameId, data, game);
      return;
    }

    if (event === SocketIOGameEvents.FINAL_QUESTION_DATA) {
      await this.emitFinalQuestionDataWithRoleBasedFiltering(
        gameId,
        data as FinalQuestionEventData,
        game
      );
      return;
    }

    await this.emitWithRoleBasedFiltering(event, game);
  }

  private async emitAnswerReveal(
    gameId: string,
    data: QuestionFinishEventPayload,
    game: Game
  ): Promise<void> {
    const publicData = projectAnswerReveal(data);
    try {
      const sockets = await this.realtimeGateway.getRoomSocketIds(gameId);
      const sessions = await this.socketUserDataService.getSocketDataBatch(sockets);
      for (const socketId of sockets) {
        const session = sessions.get(socketId);
        const player =
          session?.gameId === gameId
            ? game.getPlayer(session.id, { fetchDisconnected: false })
            : null;
        this.realtimeGateway.publish(
          RealtimeEvents.toSocket(
            socketId,
            SocketIOGameEvents.QUESTION_FINISH,
            player?.role === PlayerRole.SHOWMAN ? data : publicData
          )
        );
      }
    } catch (error) {
      this.logger.error(`Could not deliver private answer speech: ${error}`, {
        prefix: LogPrefix.BROADCAST,
        gameId
      });
      this.realtimeGateway.publish(
        RealtimeEvents.toRoom(gameId, SocketIOGameEvents.QUESTION_FINISH, publicData)
      );
    }
  }

  private async emitScriptState(game: Game, source: ScriptBroadcastSource): Promise<void> {
    const event = SocketIOGameEvents.QUESTION_SCRIPT_STATE;
    const payloadFor = (viewerId?: number, host = false) => {
      const gameState = projectScriptState(game, viewerId, host);
      if (source.question) {
        gameState.currentQuestion = projectScriptQuestion(game.gameState, source.question, host);
      }
      return { gameState, scores: source.scores, outcomes: source.outcomes };
    };
    try {
      const ids = await this.realtimeGateway.getRoomSocketIds(game.id);
      const sessions = ids.length
        ? await this.socketUserDataService.getSocketDataBatch(ids)
        : new Map();
      if (sessions.size) {
        for (const socketId of ids) {
          const session = sessions.get(socketId);
          const player =
            session?.gameId === game.id
              ? game.getPlayer(session.id, { fetchDisconnected: false })
              : null;
          this.realtimeGateway.publish(
            RealtimeEvents.toSocket(
              socketId,
              event,
              payloadFor(player?.meta.id, player?.role === PlayerRole.SHOWMAN)
            )
          );
        }
        return;
      }
    } catch (error) {
      this.logger.warn(`Could not personalize script state: ${error}`, {
        prefix: LogPrefix.BROADCAST,
        gameId: game.id
      });
    }
    // Failed recipient lookup never exposes private price bounds or submissions.
    this.realtimeGateway.publish(RealtimeEvents.toRoom(game.id, event, payloadFor()));
  }

  private async emitFinalBid(gameId: string, bid: FinalBidSubmitOutputData): Promise<void> {
    const { playerId, isAutomatic, bidAmount } = bid;
    if (bidAmount === undefined) {
      this.logger.error("Missing amount in final bid broadcast", {
        prefix: LogPrefix.BROADCAST,
        gameId,
        playerId
      });
      return;
    }

    const event = SocketIOGameEvents.FINAL_BID_SUBMIT;
    const publicBidSubmission = { playerId, ...(isAutomatic === undefined ? {} : { isAutomatic }) };
    this.realtimeGateway.publish(RealtimeEvents.toRoom(gameId, event, publicBidSubmission));

    try {
      const socketIds = await this.realtimeGateway.getRoomSocketIds(gameId);
      if (socketIds.length === 0) {
        return;
      }

      const sessions = await this.socketUserDataService.getSocketDataBatch(socketIds);
      for (const [socketId, session] of sessions) {
        if (session?.id === playerId && session.gameId === gameId) {
          this.realtimeGateway.publish(
            RealtimeEvents.toSocket(socketId, event, { ...publicBidSubmission, bidAmount })
          );
        }
      }
    } catch (error) {
      this.logger.error(`Could not deliver private final bid: ${error}`, {
        prefix: LogPrefix.BROADCAST,
        gameId
      });
    }
  }

  /**
   * Role-based filtering emit for game state broadcasts.
   * Sends filtered game state to each player based on their role.
   */
  private async emitWithRoleBasedFiltering(event: IOEvent, game: Game): Promise<void> {
    try {
      const socketIds = await this.realtimeGateway.getRoomSocketIds(game.id);
      if (socketIds.length > 0) {
        const broadcastMap = await this.questionService.getGameStateBroadcastMap(socketIds, game);
        for (const [socketId, gameState] of broadcastMap) {
          this.realtimeGateway.publish(RealtimeEvents.toSocket(socketId, event, { gameState }));
        }
        if (broadcastMap.size > 0) {
          return;
        }
      }
    } catch (error: unknown) {
      this.logger.error(`Error in role-based filtering emit: ${JSON.stringify(error)}`, {
        prefix: LogPrefix.BROADCAST
      });
    }

    // Recipient lookup can fail; the room fallback must contain only public game data.
    this.realtimeGateway.publish(
      RealtimeEvents.toRoom(game.id, event, {
        gameState: projectScriptState(game)
      })
    );
  }

  /**
   * Final question: the showman's copy keeps the answer so they can judge,
   * everyone else gets the answer-free question.
   */
  private async emitFinalQuestionDataWithRoleBasedFiltering(
    gameId: string,
    payload: FinalQuestionEventData,
    game: Game
  ): Promise<void> {
    const fullQuestion = payload.questionData.question as PackageQuestionDTO;
    const publicPayload: FinalQuestionEventData = {
      ...payload,
      questionData: {
        ...payload.questionData,
        question: GameQuestionMapper.mapToSimpleQuestion(fullQuestion, false)
      }
    };

    try {
      const socketIds = await this.realtimeGateway.getRoomSocketIds(gameId);
      const broadcastMap =
        socketIds.length > 0
          ? await this.questionService.mapSocketToQuestionPayload(socketIds, game, fullQuestion)
          : new Map();

      if (broadcastMap.size === 0) {
        this.realtimeGateway.publish(
          RealtimeEvents.toRoom(gameId, SocketIOGameEvents.FINAL_QUESTION_DATA, publicPayload)
        );

        return;
      }

      for (const [socketId, question] of broadcastMap.entries()) {
        this.realtimeGateway.publish(
          RealtimeEvents.toSocket(socketId, SocketIOGameEvents.FINAL_QUESTION_DATA, {
            ...payload,
            questionData: { ...payload.questionData, question }
          } satisfies FinalQuestionEventData)
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error in final-question-data role-based filtering emit: ${JSON.stringify(error)}`,
        { prefix: LogPrefix.BROADCAST }
      );

      this.realtimeGateway.publish(
        RealtimeEvents.toRoom(gameId, SocketIOGameEvents.FINAL_QUESTION_DATA, publicPayload)
      );
    }
  }

  private async emitQuestionDataWithRoleBasedFiltering(
    gameId: string,
    data: unknown,
    game: Game
  ): Promise<void> {
    const payload = data as GameQuestionDataEventPayload & {
      data: PackageQuestionDTO;
    };

    try {
      const socketIds = await this.realtimeGateway.getRoomSocketIds(gameId);
      const broadcastMap = await this.questionService.mapSocketToQuestionPayload(
        socketIds,
        game,
        payload.data
      );

      for (const [socketId, questionData] of broadcastMap.entries()) {
        this.realtimeGateway.publish(
          RealtimeEvents.toSocket(socketId, SocketIOGameEvents.QUESTION_DATA, {
            ...payload,
            questionState: game.gameState.questionState,
            data: questionData
          } satisfies GameQuestionDataEventPayload)
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error in question-data role-based filtering emit: ${JSON.stringify(error)}`,
        {
          prefix: LogPrefix.BROADCAST
        }
      );
    }
  }
}

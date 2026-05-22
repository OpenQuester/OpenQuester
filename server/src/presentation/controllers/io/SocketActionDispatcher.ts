import { type Socket } from "socket.io";

import { GameActionExecutor } from "application/executors/GameActionExecutor";
import { GameActionBroadcastService } from "application/services/broadcast/GameActionBroadcastService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { ErrorController } from "domain/errors/ErrorController";
import { type GameAction } from "domain/types/action/GameAction";
import { type ILogger } from "shared/logging/ILogger";
import { LogContextService } from "shared/logging/LogContext";
import { LogPrefix } from "shared/logging/LogPrefix";
import { LogTag } from "shared/logging/LogTag";
import { SocketUserDataService } from "application/services/socket/SocketUserDataService";
import { ValueUtils } from "domain/utils/ValueUtils";
import {
  GameIdStrategy,
  SOCKET_ACTION_MAP,
  type SocketActionEntry
} from "presentation/controllers/io/SocketActionMap";
import { MetricsService } from "application/services/metrics/MetricsService";
import { asUserId } from "domain/types/ids";

/**
 * Generic socket-event dispatcher with a single, config-driven dispatch loop.
 *
 * For every entry in {@link SOCKET_ACTION_MAP} the dispatcher registers
 * one `socket.on(event, ...)` listener that:
 *
 * 1. Resolves the userId (cached on socket, fallback to Redis session).
 * 2. Register `socket.on` action callback for every event
 * 3. Inside callback: validates the input payload (Joi, if a validator is configured).
 * 4. Resolves the gameId (by strategy: session or payload).
 * 5. Builds a {@link GameAction} and submits it to the executor
 *    (queued or direct, per config).
 * 6. Records metrics and logs.
 *
 * Post-execution hooks are run inside GameActionExecutor so queued actions
 * execute the same side effects as immediately processed actions.
 */
export class SocketActionDispatcher {
  constructor(
    private readonly actionExecutor: GameActionExecutor,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly socketUserDataService: SocketUserDataService,
    private readonly broadcastService: GameActionBroadcastService,
    private readonly metricsService: MetricsService,
    private readonly logger: ILogger
  ) {}

  /**
   * Register all socket event listeners from the action map.
   * Called once per connected socket.
   */
  public async registerAll(socket: Socket): Promise<void> {
    for (const entry of SOCKET_ACTION_MAP) {
      socket.on(entry.event, async (data: unknown) => {
        await this.dispatch(socket, entry, data);
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Main dispatch
  // ════════════════════════════════════════════════════════════════════════

  private async dispatch(
    socket: Socket,
    entry: SocketActionEntry,
    rawData: unknown
  ): Promise<void> {
    const logContext = LogContextService.createContext({
      socketId: socket.id,
      tags: new Set([LogTag.SOCKET])
    });

    await LogContextService.runAsync(logContext, async () => {
      const startTime = Date.now();

      try {
        await this.resolveUserId(socket);

        if (socket.userId === undefined) {
          throw new ClientError(ClientResponse.SOCKET_USER_NOT_AUTHENTICATED);
        }

        logContext.userId = socket.userId;

        this.logger.debug(`Socket event received: ${entry.event}`, {
          prefix: LogPrefix.SOCKET,
          userId: socket.userId,
          socketId: socket.id
        });

        // 1. Validate input
        const payload = entry.inputValidator ? entry.inputValidator(rawData) : (rawData ?? {});

        // 2. Resolve gameId
        const gameId = await this.resolveGameId(socket, entry, payload);

        // 3. Handle gameId existence
        // TODO: Maybe will need to approve that game exists, unless handled later on
        if (gameId) {
          LogContextService.setGameId(gameId);
          LogContextService.addTag(LogTag.GAME);
        } else {
          if (entry.allowNullGameId) {
            this.logSuccess(entry.event, startTime);
            this.recordMetrics(entry.event, "success", startTime);
            return;
          }
          throw new ClientError(ClientResponse.GAME_NOT_FOUND);
        }

        // 4. Build action
        const action = this.buildAction(socket, entry, payload, gameId);

        // 5. Submit
        await (entry.directExecution
          ? this.actionExecutor.submitDirectAction(action)
          : this.actionExecutor.submitAction(action));

        this.logSuccess(entry.event, startTime);
        this.recordMetrics(entry.event, "success", startTime);
      } catch (error) {
        this.recordMetrics(entry.event, "error", startTime);
        await this.handleError(socket, entry.event, error, startTime);
      }
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  UserId resolution
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Ensure socket runtime context is populated. In multi-instance deployments
   * the HTTP auth request may land on a different instance, so the first event
   * lazily fetches the Redis session once and caches it on the live socket.
   */
  private async resolveUserId(socket: Socket): Promise<void> {
    if (socket.userId !== undefined && socket.gameId !== undefined) {
      return;
    }

    const data = await this.socketUserDataService.getSocketData(socket.id);
    if (data?.id) {
      socket.userId = data.id;
      socket.gameId = data.gameId;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  GameId resolution
  // ════════════════════════════════════════════════════════════════════════

  private async resolveGameId(
    socket: Socket,
    entry: SocketActionEntry,
    payload: unknown
  ): Promise<string | null> {
    switch (entry.gameIdStrategy) {
      case GameIdStrategy.FROM_SESSION:
        if (socket.gameId !== undefined) {
          return socket.gameId;
        }
        {
          const gameId = await this.socketGameContextService.getGameIdForSocket(socket.id);
          socket.gameId = gameId;

          return gameId;
        }

      case GameIdStrategy.FROM_PAYLOAD:
        return (payload as Record<string, unknown>)?.gameId as string | null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Action builder
  // ════════════════════════════════════════════════════════════════════════

  private buildAction(
    socket: Socket,
    entry: SocketActionEntry,
    payload: unknown,
    gameId: string
  ): GameAction {
    const userGameId =
      entry.gameIdStrategy === GameIdStrategy.FROM_PAYLOAD ? (socket.gameId ?? null) : gameId;

    return {
      id: ValueUtils.generateUUID(),
      type: entry.actionType,
      gameId,
      playerId: socket.userId!,
      socketId: socket.id,
      timestamp: new Date(),
      payload,
      userData: {
        id: asUserId(socket.userId!),
        gameId: userGameId
      }
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Error handling
  // ════════════════════════════════════════════════════════════════════════

  private async handleError(
    socket: Socket,
    event: string,
    error: unknown,
    startTime: number
  ): Promise<void> {
    const durationMs = Date.now() - startTime;

    try {
      const { message } = await ErrorController.resolveError(error, this.logger, undefined, {
        source: "socket",
        event,
        userId: socket.userId,
        durationMs
      });

      this.emitError(socket, message);
    } catch (handlingError) {
      this.logger.error(`Error while handling socket event error`, {
        prefix: LogPrefix.SOCKET,
        handlingError: String(handlingError),
        originalError: String(error)
      });
    }
  }

  private emitError(socket: Socket, message: string): void {
    try {
      this.broadcastService.emitError(socket.id, message);
    } catch {
      // Socket might have disconnected — expected, no log needed
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Metrics & logging
  // ════════════════════════════════════════════════════════════════════════

  private recordMetrics(event: string, status: "success" | "error", startTime: number): void {
    const durationSeconds = (Date.now() - startTime) / 1000;
    this.metricsService.recordSocketEvent({ event, status }, durationSeconds);
  }

  private logSuccess(event: string, startTime: number): void {
    this.logger.trace(`Socket event completed`, {
      prefix: LogPrefix.SOCKET,
      event,
      durationMs: Date.now() - startTime
    });
  }
}

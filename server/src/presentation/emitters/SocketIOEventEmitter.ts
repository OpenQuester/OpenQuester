import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import {
  SocketIOEvents,
  SocketIOGameEvents,
  SocketIOUserEvents,
} from "domain/enums/SocketIOEvents";
import { ServerError } from "domain/errors/ServerError";
import { GameStateDTO } from "domain/types/dto/game/state/GameStateDTO";
import { SocketEventEmitter } from "domain/types/socket/EmitTarget";
import { ILogger } from "infrastructure/logger/ILogger";
import { Namespace, Server, Socket } from "socket.io";

type IOEVent = SocketIOEvents | SocketIOGameEvents | SocketIOUserEvents;

export class SocketIOEventEmitter {
  private _io?: Namespace | Server;
  private _socket?: Socket;

  constructor(
    private readonly gameService: SocketIOGameService,
    private readonly logger: ILogger
  ) {
    //
  }

  public init(io: Namespace | Server, socket: Socket) {
    this._io = io;
    this._socket = socket;
  }

  /**
   * Generic emitting method
   * @param event Socket io event to emit
   * @param data Data of generic type `T` which will be emitted
   * @param options Optional, target is `socket` by default
   */
  public emit<T>(
    event: IOEVent,
    data: T,
    options?: { emitter: SocketEventEmitter; gameId?: string }
  ) {
    if (!this._io || !this._socket) {
      throw new ServerError("SocketIOEventEmitter not initialized");
    }

    const opts = options ? options : { emitter: SocketEventEmitter.SOCKET };
    const emitter =
      opts.emitter === SocketEventEmitter.IO ? this._io : this._socket;

    if (opts.gameId) {
      emitter.to(opts.gameId).emit(event, data);
    } else {
      emitter.emit(event, data);
    }
  }

  /**
   * Emits to socket using io (not socket) emitter
   * @param event Socket io event to emit
   * @param data Data of generic type `T` which will be emitted
   * @param socketId socket id to which we emit
   */
  public emitToSocket<T>(event: IOEVent, data: T, socketId: string) {
    if (!this._io || !this._socket) {
      throw new ServerError("SocketIOEventEmitter not initialized");
    }
    const emitter = this._io;
    emitter.to(socketId).emit(event, data);
  }

  /**
   * Special emit method for handling role-based broadcasting
   * This is used for events where different users in a game should receive different data
   * based on their role (e.g. Showman vs Player for final round data)
   *
   * This is specifically for GameStateDTO broadcasts in next round events
   */
  public async emitWithRoleBasedFiltering(
    event: IOEVent,
    data: { gameState: GameStateDTO },
    gameId: string
  ): Promise<void> {
    if (!this._io || !this._socket) {
      throw new ServerError("SocketIOEventEmitter not initialized");
    }

    try {
      // Get all socket IDs in the game room
      const sockets = await this._io.in(gameId).fetchSockets();
      const socketIds = sockets.map((socket) => socket.id);

      // Use the game service to get the broadcast map
      const broadcastMap = await this.gameService.getGameStateBroadcastMap(
        socketIds,
        gameId,
        data.gameState
      );

      // Emit to each socket with the appropriate data
      for (const [socketId, gameState] of broadcastMap.entries()) {
        const customData = { ...data, gameState };
        this.emitToSocket(event, customData, socketId);
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error in role-based filtering emit: ${JSON.stringify(error)}`,
        {
          prefix: "[IOEventEmitter]: ",
        }
      );
      // Fallback to regular room emit if role-based filtering fails
      this._io.to(gameId).emit(event, data);
    }
  }
}

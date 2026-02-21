import {
  SocketIOEvents,
  SocketIOGameEvents,
  SocketIOUserEvents,
} from "domain/enums/SocketIOEvents";
import { ServerError } from "domain/errors/ServerError";
import { SocketEventEmitter } from "domain/types/socket/EmitTarget";
import { Namespace, Server, Socket } from "socket.io";

type IOEVent = SocketIOEvents | SocketIOGameEvents | SocketIOUserEvents;

export class SocketIOEventEmitter {
  private _io?: Namespace | Server;
  private _socket?: Socket;

  constructor() {
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

}

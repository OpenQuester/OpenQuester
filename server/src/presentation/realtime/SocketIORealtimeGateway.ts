import { type Namespace } from "socket.io";

import { type RealtimeEvent, RealtimeEventTarget } from "application/ports/realtime/RealtimeEvent";
import {
  type RealtimeGateway,
  type SocketRuntimeContextUpdate
} from "application/ports/realtime/RealtimeGateway";
import { SOCKET_RUNTIME_CONTEXT_UPDATE_EVENT } from "domain/constants/socket";
import { ServerError } from "domain/errors/ServerError";

export class SocketIORealtimeGateway implements RealtimeGateway {
  constructor(private readonly namespace: Namespace) {
    this.namespace.on(
      SOCKET_RUNTIME_CONTEXT_UPDATE_EVENT,
      (update: SocketRuntimeContextUpdate) => {
        this._applySocketContext(update);
      }
    );
  }

  public publish(event: RealtimeEvent): void {
    switch (event.target) {
      case RealtimeEventTarget.ALL:
        this.namespace.emit(event.event, event.payload);
        return;
      case RealtimeEventTarget.ROOM:
        if (!event.roomId) {
          throw new ServerError("Realtime room event requires roomId");
        }
        this.namespace.to(event.roomId).emit(event.event, event.payload);
        return;
      case RealtimeEventTarget.SOCKET:
        if (!event.socketId) {
          throw new ServerError("Realtime socket event requires socketId");
        }
        this.namespace.to(event.socketId).emit(event.event, event.payload);
        return;
    }
  }

  public publishMany(events: RealtimeEvent[]): void {
    for (const event of events) {
      this.publish(event);
    }
  }

  public joinRoom(socketId: string, roomId: string): void {
    this.namespace.in(socketId).socketsJoin(roomId);
  }

  public leaveRoom(socketId: string, roomId: string): void {
    this.namespace.in(socketId).socketsLeave(roomId);
  }

  public disconnectSocket(socketId: string): void {
    this.namespace.in(socketId).disconnectSockets(true);
  }

  public updateSocketContext(update: SocketRuntimeContextUpdate): void {
    this._applySocketContext(update);
    this.namespace.serverSideEmit(SOCKET_RUNTIME_CONTEXT_UPDATE_EVENT, update);
  }

  public async getRoomSocketIds(roomId: string): Promise<string[]> {
    const sockets = await this.namespace.in(roomId).fetchSockets();
    return sockets.map((socket) => socket.id);
  }

  public getOnlineSocketCount(): number {
    // Counts only sockets connected to this server process.
    return this.namespace.sockets.size;
  }

  /*
   * Runtime context updates are sent to every server instance.
   * Each instance applies the update only when that socket exists locally.
   */
  private _applySocketContext(update: SocketRuntimeContextUpdate): void {
    const socket = this.namespace.sockets.get(update.socketId);
    if (!socket) {
      return;
    }

    if (update.userId !== undefined) {
      socket.userId = update.userId;
    }
    if (update.gameId !== undefined) {
      socket.gameId = update.gameId;
    }
    if (update.mutedUntil !== undefined) {
      socket.mutedUntil = update.mutedUntil;
    }
  }
}

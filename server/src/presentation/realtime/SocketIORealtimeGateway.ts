import { type Namespace } from "socket.io";

import { type RealtimeEvent, RealtimeEventTarget } from "application/ports/realtime/RealtimeEvent";
import { type RealtimeGateway } from "application/ports/realtime/RealtimeGateway";
import { ServerError } from "domain/errors/ServerError";

export class SocketIORealtimeGateway implements RealtimeGateway {
  constructor(private readonly namespace: Namespace) {
    //
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

  public async getRoomSocketIds(roomId: string): Promise<string[]> {
    const sockets = await this.namespace.in(roomId).fetchSockets();
    return sockets.map((socket) => socket.id);
  }

  public getOnlineSocketCount(): number {
    return this.namespace.sockets.size;
  }
}

import { type RealtimeEvent } from "application/ports/realtime/RealtimeEvent";

export interface RealtimeGateway {
  publish(event: RealtimeEvent): void;
  publishMany(events: RealtimeEvent[]): void;
  joinRoom(socketId: string, roomId: string): void;
  leaveRoom(socketId: string, roomId: string): void;
  disconnectSocket(socketId: string): void;
  getRoomSocketIds(roomId: string): Promise<string[]>;
  getOnlineSocketCount(): number;
}

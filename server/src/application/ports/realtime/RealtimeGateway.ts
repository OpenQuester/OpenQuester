import { type RealtimeEvent } from "application/ports/realtime/RealtimeEvent";

export interface SocketRuntimeContextUpdate {
  socketId: string;
  userId?: number;
  gameId?: string | null;
}

export interface RealtimeGateway {
  publish(event: RealtimeEvent): void;
  publishMany(events: RealtimeEvent[]): void;
  joinRoom(socketId: string, roomId: string): void;
  leaveRoom(socketId: string, roomId: string): void;
  disconnectSocket(socketId: string): void;
  updateSocketContext(update: SocketRuntimeContextUpdate): void;
  getRoomSocketIds(roomId: string): Promise<string[]>;
  getOnlineSocketCount(): number;
}

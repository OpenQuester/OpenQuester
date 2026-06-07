export enum RealtimeEventTarget {
  ALL = "all",
  ROOM = "room",
  SOCKET = "socket"
}

export interface RealtimeEvent<TPayload = unknown> {
  event: string;
  payload: TPayload;
  target: RealtimeEventTarget;
  roomId?: string;
  socketId?: string;
}

export class RealtimeEvents {
  public static toAll<TPayload>(event: string, payload: TPayload): RealtimeEvent<TPayload> {
    return {
      event,
      payload,
      target: RealtimeEventTarget.ALL
    };
  }

  public static toRoom<TPayload>(
    roomId: string,
    event: string,
    payload: TPayload
  ): RealtimeEvent<TPayload> {
    return {
      event,
      payload,
      target: RealtimeEventTarget.ROOM,
      roomId
    };
  }

  public static toSocket<TPayload>(
    socketId: string,
    event: string,
    payload: TPayload
  ): RealtimeEvent<TPayload> {
    return {
      event,
      payload,
      target: RealtimeEventTarget.SOCKET,
      socketId
    };
  }
}

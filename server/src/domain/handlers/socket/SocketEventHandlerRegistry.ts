import {
  SocketIOEvents,
  SocketIOGameEvents,
} from "domain/enums/SocketIOEvents";
import { type ILogger } from "infrastructure/logger/ILogger";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";
import { Socket } from "socket.io";
import { BaseSocketEventHandler } from "./BaseSocketEventHandler";

/**
 * Registry for managing socket event handlers
 * Provides centralized registration and automatic event binding
 */
export class SocketEventHandlerRegistry {
  private handlers = new Map<string, BaseSocketEventHandler>();
  private socket: Socket;
  private eventEmitter: SocketIOEventEmitter;
  private logger: ILogger;

  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    logger: ILogger
  ) {
    this.socket = socket;
    this.eventEmitter = eventEmitter;
    this.logger = logger;
  }

  /**
   * Register a handler instance directly
   */
  public registerInstance(handler: BaseSocketEventHandler): void {
    const eventName = handler.getEventName();

    if (this.handlers.has(eventName)) {
      this.logger.warn(
        `Handler for event ${eventName} is already registered. Skipping duplicate.`,
        { prefix: "[SOCKET]: " }
      );
      return; // Prevent duplicate registration which causes double event handling
    }

    this.handlers.set(eventName, handler);

    // Bind the event to socket with error handling wrapper
    this.socket.on(eventName, async (data: any) => {
      await handler.handle(data);
    });
  }

  /**
   * Register a handler class and automatically bind it to the socket event
   */
  public register<T extends BaseSocketEventHandler>(
    HandlerClass: new (socket: Socket, eventEmitter: SocketIOEventEmitter) => T
  ): void {
    const handler = new HandlerClass(this.socket, this.eventEmitter);
    this.registerInstance(handler);
  }

  /**
   * Get statistics about registered handlers
   */
  public getStats(): {
    totalHandlers: number;
    gameEvents: number;
    systemEvents: number;
    eventNames: string[];
  } {
    const eventNames = Array.from(this.handlers.keys());
    const gameEvents = eventNames.filter((name) =>
      Object.values(SocketIOGameEvents).includes(name as SocketIOGameEvents)
    ).length;
    const systemEvents = eventNames.filter((name) =>
      Object.values(SocketIOEvents).includes(name as SocketIOEvents)
    ).length;

    return {
      totalHandlers: this.handlers.size,
      gameEvents,
      systemEvents,
      eventNames,
    };
  }
}

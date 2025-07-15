import { Server as IOServer, Namespace, Socket } from "socket.io";

import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { SocketEventHandlerFactory } from "domain/handlers/socket/SocketEventHandlerFactory";
import { SocketEventHandlerRegistry } from "domain/handlers/socket/SocketEventHandlerRegistry";
import { ILogger } from "infrastructure/logger/ILogger";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class SocketIOInitializer {
  private readonly handlerFactory: SocketEventHandlerFactory;

  constructor(
    private readonly io: IOServer,
    private readonly socketIOGameService: SocketIOGameService,
    private readonly socketIOChatService: SocketIOChatService,
    private readonly socketUserDataService: SocketUserDataService,
    private readonly finalRoundService: FinalRoundService,
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly logger: ILogger
  ) {
    this.handlerFactory = new SocketEventHandlerFactory(
      this.socketIOGameService,
      this.socketIOChatService,
      this.socketUserDataService,
      this.finalRoundService,
      this.logger,
      this.socketIOQuestionService
    );

    const gameNamespace = this.io.of(SOCKET_GAME_NAMESPACE);

    gameNamespace.on("connection", (socket: Socket) => {
      this._initializeGameControllers(gameNamespace, socket);
    });
  }

  private _initializeGameControllers(nsp: Namespace, socket: Socket) {
    const eventEmitter = new SocketIOEventEmitter(
      this.socketIOGameService,
      this.logger
    );
    eventEmitter.init(nsp, socket);

    // Initialize new standardized event handler registry
    const handlerRegistry = new SocketEventHandlerRegistry(
      socket,
      eventEmitter,
      this.logger
    );

    // Register all standardized event handlers
    const allHandlers = this.handlerFactory.createAllHandlers(
      socket,
      eventEmitter
    );
    for (const handler of allHandlers) {
      handlerRegistry.registerInstance(handler);
    }

    // Log handler registration stats
    const registryStats = handlerRegistry.getStats();
    this.logger.info(
      `Registered ${
        registryStats.totalHandlers
      } standardized socket handlers | SocketId: ${socket.id} | GameEvents: ${
        registryStats.gameEvents
      } | SystemEvents: ${
        registryStats.systemEvents
      } | Events: ${registryStats.eventNames.join(", ")}`,
      { prefix: "[SOCKET]: " }
    );
  }
}

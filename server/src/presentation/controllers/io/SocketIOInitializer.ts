import { Server as IOServer, Namespace, Socket } from "socket.io";

import { FinalRoundService } from "application/services/socket/FinalRoundService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { SocketIOQuestionService } from "application/services/socket/SocketIOQuestionService";
import { UserNotificationRoomService } from "application/services/socket/UserNotificationRoomService";
import { GameStatisticsCollectorService } from "application/services/statistics/GameStatisticsCollectorService";
import { UserService } from "application/services/user/UserService";
import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
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
    private readonly socketIOQuestionService: SocketIOQuestionService,
    private readonly finalRoundService: FinalRoundService,
    private readonly userNotificationRoomService: UserNotificationRoomService,
    private readonly gameStatisticsCollectorService: GameStatisticsCollectorService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly userService: UserService,
    private readonly logger: ILogger
  ) {
    this.handlerFactory = new SocketEventHandlerFactory(
      this.socketIOGameService,
      this.socketIOChatService,
      this.socketUserDataService,
      this.finalRoundService,
      this.userNotificationRoomService,
      this.socketIOQuestionService,
      this.gameStatisticsCollectorService,
      this.socketGameContextService,
      this.userService,
      this.logger
    );

    const gameNamespace = this.io.of(SOCKET_GAME_NAMESPACE);

    gameNamespace.on(SocketIOEvents.CONNECTION, (socket: Socket) => {
      this._initializeGameControllers(gameNamespace, socket);
    });
  }

  private _initializeGameControllers(nsp: Namespace, socket: Socket) {
    this.logger.trace(
      `Socket Game controllers initialization started for ${socket.id}`,
      {
        prefix: "[SOCKET]: ",
        socketId: socket.id,
      }
    );

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
    this.logger.trace(
      `Registered ${registryStats.totalHandlers} standardized socket handlers`,
      {
        prefix: "[SOCKET]: ",
        socketId: socket.id,
        gameEvents: registryStats.gameEvents,
        systemEvents: registryStats.systemEvents,
        events: registryStats.eventNames.join(", "),
      }
    );
  }
}

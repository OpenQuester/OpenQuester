import { Server as IOServer, Socket } from "socket.io";

import { SOCKET_GAME_NAMESPACE } from "domain/constants/socket";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { ILogger } from "shared/logging/ILogger";
import { LogPrefix } from "shared/logging/LogPrefix";
import { SocketActionDispatcher } from "presentation/controllers/io/SocketActionDispatcher";

export class SocketIOInitializer {
  constructor(
    private readonly io: IOServer,
    private readonly dispatcher: SocketActionDispatcher,
    private readonly logger: ILogger
  ) {
    const gameNamespace = this.io.of(SOCKET_GAME_NAMESPACE);

    gameNamespace.on(SocketIOEvents.CONNECTION, async (socket: Socket) => {
      this.logger.trace(`Socket Game controllers initialization started for ${socket.id}`, {
        prefix: LogPrefix.SOCKET_INIT,
        socketId: socket.id
      });

      await this.dispatcher.registerAll(socket);

      this.logger.trace(`Socket event listeners registered`, {
        prefix: LogPrefix.SOCKET_INIT,
        socketId: socket.id
      });
    });
  }
}

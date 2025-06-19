import { Socket } from "socket.io";

import { SocketIOChatService } from "application/services/socket/SocketIOChatService";
import { SocketIOGameService } from "application/services/socket/SocketIOGameService";
import { GAME_CHAT_HISTORY_RETRIEVAL_LIMIT } from "domain/constants/game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import {
  BaseSocketEventHandler,
  SocketBroadcastTarget,
  SocketEventContext,
  SocketEventResult,
} from "domain/handlers/socket/BaseSocketEventHandler";
import {
  GameJoinInputData,
  GameJoinOutputData,
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameValidator } from "domain/validators/GameValidator";
import { SocketUserDataService } from "infrastructure/services/socket/SocketUserDataService";
import { SocketIOEventEmitter } from "presentation/emitters/SocketIOEventEmitter";

export class JoinGameEventHandler extends BaseSocketEventHandler<
  GameJoinInputData,
  GameJoinOutputData
> {
  constructor(
    socket: Socket,
    eventEmitter: SocketIOEventEmitter,
    private readonly socketIOGameService: SocketIOGameService,
    private readonly socketIOChatService: SocketIOChatService,
    private readonly socketUserDataService: SocketUserDataService
  ) {
    super(socket, eventEmitter);
  }

  public getEventName(): SocketIOGameEvents {
    return SocketIOGameEvents.JOIN;
  }

  protected async validateInput(
    data: GameJoinInputData
  ): Promise<GameJoinInputData> {
    return GameValidator.validateJoinInput(data);
  }

  protected async authorize(
    data: GameJoinInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Check if socket is already in this game room
    if (this.socket.rooms.has(data.gameId)) {
      // Double-check with Redis state in case there's a race condition
      const socketData = await this.socketUserDataService.getSocketData(
        this.socket.id
      );
      if (socketData?.gameId === data.gameId) {
        throw new ClientError(ClientResponse.ALREADY_IN_GAME);
      }
      // If Redis says not in game, force leave the socket room to sync state
      await this.socket.leave(data.gameId);
    }

    // TODO: Additional authorization checks could be added here
    // For example: check if user is banned, game is private, etc.
  }

  protected async beforeHandle(
    _data: GameJoinInputData,
    _context: SocketEventContext
  ): Promise<void> {
    // Could add pre-join logging, metrics, etc.
  }

  protected async execute(
    data: GameJoinInputData,
    _context: SocketEventContext
  ): Promise<SocketEventResult<GameJoinOutputData>> {
    const result = await this.socketIOGameService.joinPlayer(
      data,
      this.socket.id
    );
    const { player, game } = result;

    // Join the socket room
    await this.socket.join(data.gameId);

    // Prepare the response data
    const gameJoinData: GameJoinOutputData = {
      meta: {
        title: game.title,
      },
      players: game.players.map((p) => p.toDTO()),
      gameState: game.gameState,
      chatMessages: await this.socketIOChatService.getMessages(
        game.id,
        game.createdAt,
        GAME_CHAT_HISTORY_RETRIEVAL_LIMIT
      ),
    };

    // Return result with broadcasting instructions
    return {
      success: true,
      data: gameJoinData,
      broadcast: [
        {
          event: SocketIOGameEvents.JOIN,
          data: player.toDTO(),
          target: SocketBroadcastTarget.GAME,
          gameId: data.gameId,
        },
        {
          event: SocketIOGameEvents.GAME_DATA,
          data: gameJoinData,
          target: SocketBroadcastTarget.SOCKET,
        },
      ],
    };
  }
}

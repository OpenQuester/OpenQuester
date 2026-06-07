import { singleton } from "tsyringe";

import { SocketChatRepository } from "infrastructure/database/repositories/socket/SocketChatRepository";

/**
 * Service for game chat operations.
 */
@singleton()
export class SocketIOChatService {
  constructor(
    private readonly socketChatRepository: SocketChatRepository
  ) {
    //
  }

  public async getMessages(gameId: string, gameCreatedAt: Date, limit: number) {
    return this.socketChatRepository.getMessages(gameId, gameCreatedAt, limit);
  }
}

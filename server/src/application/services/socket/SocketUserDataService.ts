import { singleton } from "tsyringe";

import { SocketRedisUserUpdateDTO } from "domain/types/dto/user/SocketRedisUserUpdateDTO";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { SocketUserDataRepository } from "infrastructure/database/repositories/socket/SocketUserDataRepository";

/**
 * Service for managing socket user session data.
 */
@singleton()
export class SocketUserDataService {
  constructor(
    private readonly socketUserDataRepository: SocketUserDataRepository
  ) {
    //
  }

  public async getSocketData(
    socketId: string
  ): Promise<SocketRedisUserData | null> {
    return this.socketUserDataRepository.getSocketData(socketId);
  }

  public async getSocketDataBatch(
    socketIds: string[]
  ): Promise<Map<string, SocketRedisUserData | null>> {
    return this.socketUserDataRepository.getSocketDataBatch(socketIds);
  }

  public async set(
    socketId: string,
    data: { userId: number; language: string; mutedUntil?: string | Date | null }
  ) {
    return this.socketUserDataRepository.set(socketId, data);
  }

  public async update(socketId: string, data: SocketRedisUserUpdateDTO) {
    return this.socketUserDataRepository.update(socketId, data);
  }

  public async remove(socketId: string) {
    return this.socketUserDataRepository.remove(socketId);
  }

  /**
   * Cleans up all socket auth sessions since on server restart connections recreated
   */
  public async cleanupAllSession(): Promise<void> {
    return this.socketUserDataRepository.cleanupAllSession();
  }

  /**
   * Find the socket ID for a specific user ID
   * Since users can only have one socket in the game, this returns the single socket ID
   */
  public async findSocketIdByUserId(userId: number): Promise<string | null> {
    return this.socketUserDataRepository.findSocketIdByUserId(userId);
  }

  public async setUserMuteExpiration(
    userId: number,
    mutedUntil: string | Date | null
  ): Promise<void> {
    return this.socketUserDataRepository.setUserMuteExpiration(userId, mutedUntil);
  }

  public async clearUserMuteExpiration(userId: number): Promise<void> {
    return this.socketUserDataRepository.clearUserMuteExpiration(userId);
  }
}

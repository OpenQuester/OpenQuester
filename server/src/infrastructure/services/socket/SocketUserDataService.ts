import { SocketRedisUserUpdateDTO } from "domain/types/dto/user/SocketRedisUserUpdateDTO";
import { SocketRedisUserData } from "domain/types/user/SocketRedisUserData";
import { SocketUserDataRepository } from "infrastructure/database/repositories/socket/SocketUserDataRepository";

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

  public async set(
    socketId: string,
    data: { userId: number; language: string }
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
}

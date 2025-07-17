import { type Request } from "express";
import { type Server as IOServer } from "socket.io";

import { UserService } from "application/services/user/UserService";
import { Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { HttpStatus } from "domain/enums/HttpStatus";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { GameEvent, GameEventDTO } from "domain/types/dto/game/GameEventDTO";
import { GameListItemDTO } from "domain/types/dto/game/GameListItemDTO";
import { GameStateTimerDTO } from "domain/types/dto/game/state/GameStateTimerDTO";
import { GamePaginationOpts } from "domain/types/pagination/game/GamePaginationOpts";
import { GameRepository } from "infrastructure/database/repositories/GameRepository";
import { ILogger } from "infrastructure/logger/ILogger";

export class GameService {
  constructor(
    private readonly io: IOServer,
    private readonly gameRepository: GameRepository,
    private readonly userService: UserService,
    private readonly logger: ILogger
  ) {
    //
  }

  public async get(
    gameId: string,
    updatedTtl?: number
  ): Promise<GameListItemDTO> {
    const log = this.logger.performance(`Game retrieval`, {
      gameId,
      updatedTtl,
    });

    const game = await this.gameRepository.getGame(gameId, updatedTtl);

    log.finish();

    return game;
  }

  public async getGameEntity(
    gameId: string,
    updatedTtl?: number
  ): Promise<Game> {
    return this.gameRepository.getGameEntity(gameId, updatedTtl);
  }

  public async list(paginationOpts: GamePaginationOpts) {
    return this.gameRepository.getAllGames(paginationOpts);
  }

  public async delete(req: Request, gameId: string) {
    const user = await this.userService.getUserByRequest(req, {
      select: ["id"],
      relations: [],
    });

    if (!user) {
      throw new ClientError(
        ClientResponse.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    await this.gameRepository.deleteGame(user.id, gameId);

    const eventDataDTO: GameEventDTO = {
      event: GameEvent.DELETED,
      data: {
        id: gameId,
      },
    };

    this.io.emit(SocketIOEvents.GAMES, eventDataDTO);
  }

  public async create(req: Request, gameData: GameCreateDTO) {
    const createdByUser = await this.userService.getUserByRequest(req, {
      select: ["id", "username"],
      relations: [],
    });

    if (!createdByUser) {
      throw new ClientError(
        ClientResponse.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    const gameDataOutput = await this.gameRepository.createGame(
      gameData,
      createdByUser
    );

    this._emitSocketGameCreated(gameDataOutput);

    return gameDataOutput;
  }

  public async cleanupAllGames() {
    return this.gameRepository.cleanupAllGames();
  }

  public async updateGame(game: Game) {
    return this.gameRepository.updateGame(game);
  }

  public async cleanOrphanedGames() {
    return this.gameRepository.cleanOrphanedGames();
  }

  /**
   * @param timerAdditional means additional body between timer and gameId,
   *  e.g. timer:showing:ABCD, it this case timerAdditional is 'showing'
   */
  public async getTimer(gameId: string, timerAdditional?: string) {
    return this.gameRepository.getTimer(gameId, timerAdditional);
  }

  /**
   * @param timerAdditional means additional body between timer and gameId,
   *  e.g. timer:showing:ABCD, it this case timerAdditional is 'showing'
   * @param ttl in milliseconds
   */
  public async saveTimer(
    timer: GameStateTimerDTO,
    gameId: string,
    ttl?: number,
    timerAdditional?: string
  ) {
    return this.gameRepository.saveTimer(timer, gameId, timerAdditional, ttl);
  }

  public async clearTimer(gameId: string, timerAdditional?: string) {
    return this.gameRepository.clearTimer(gameId, timerAdditional);
  }

  /**
   * @param expire seconds to expire the lock
   */
  public async gameLock(key: string, expire: number): Promise<boolean> {
    return this.gameRepository.gameLock(key, expire);
  }

  private _emitSocketGameCreated(gameData: GameListItemDTO) {
    const eventDataDTO: GameEventDTO = {
      event: GameEvent.CREATED,
      data: gameData,
    };

    this.io.emit(SocketIOEvents.GAMES, eventDataDTO);
  }
}
